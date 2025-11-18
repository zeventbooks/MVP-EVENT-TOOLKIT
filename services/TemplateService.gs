/**
 * TemplateService.gs
 *
 * Enhanced multi-template system for event-agnostic, flexible event management
 *
 * Features:
 * - Template versioning with migration paths
 * - Template inheritance and composition
 * - Conditional fields based on template type
 * - Dynamic template rendering
 * - Multi-language template support
 * - Template validation and testing
 *
 * @version 1.0.0
 * @since 2025-11-18
 */

/**
 * Get template by ID with inheritance resolution
 *
 * @param {string} templateId - Template ID
 * @param {string} [locale] - Optional locale for localized templates
 * @returns {Object} Result envelope with resolved template
 */
function TemplateService_getTemplate(templateId, locale) {
  try {
    if (!templateId) {
      return Err('BAD_INPUT', 'Missing required parameter: templateId');
    }

    // Load templates from Config
    const template = findTemplate_(templateId);

    if (!template) {
      return Err('NOT_FOUND', `Template not found: ${templateId}`);
    }

    // Resolve inheritance chain
    const resolvedTemplate = resolveTemplateInheritance_(template);

    // Apply locale-specific overrides if provided
    if (locale && resolvedTemplate.locales && resolvedTemplate.locales[locale]) {
      Object.assign(resolvedTemplate, resolvedTemplate.locales[locale]);
    }

    Logger.log(`Template ${templateId} resolved successfully`);

    return Ok({
      template: resolvedTemplate
    });

  } catch (err) {
    Logger.log('TemplateService_getTemplate error: ' + err);
    return Err('INTERNAL_ERROR', 'Failed to get template: ' + err.message);
  }
}

/**
 * List all available templates
 *
 * @param {Object} [params] - Optional parameters
 * @param {string} [params.category] - Filter by category
 * @param {string} [params.locale] - Filter by locale
 * @param {boolean} [params.includeDeprecated=false] - Include deprecated templates
 * @returns {Object} Result envelope with templates array
 */
function TemplateService_listTemplates(params) {
  try {
    params = params || {};

    // Load all templates from Config
    let templates = TEMPLATES || [];

    // Filter by category
    if (params.category) {
      templates = templates.filter(t => t.category === params.category);
    }

    // Filter deprecated unless requested
    if (!params.includeDeprecated) {
      templates = templates.filter(t => !t.deprecated);
    }

    // Map to summary format (exclude detailed field definitions)
    const templateSummaries = templates.map(t => ({
      id: t.id,
      label: t.label,
      description: t.description,
      category: t.category || 'general',
      version: t.version || 1,
      deprecated: t.deprecated || false,
      extendsFrom: t.extendsFrom || null,
      locales: Object.keys(t.locales || {})
    }));

    return Ok({
      templates: templateSummaries,
      count: templateSummaries.length
    });

  } catch (err) {
    Logger.log('TemplateService_listTemplates error: ' + err);
    return Err('INTERNAL_ERROR', 'Failed to list templates: ' + err.message);
  }
}

/**
 * Validate data against template schema
 *
 * @param {string} templateId - Template ID
 * @param {Object} data - Data to validate
 * @param {string} [locale] - Optional locale
 * @returns {Object} Result envelope with validation result
 */
function TemplateService_validateData(templateId, data, locale) {
  try {
    if (!templateId || !data) {
      return Err('BAD_INPUT', 'Missing required parameters: templateId, data');
    }

    const templateResult = TemplateService_getTemplate(templateId, locale);
    if (!templateResult.ok) {
      return templateResult;
    }

    const template = templateResult.value.template;
    const errors = [];

    // Validate each field
    for (const field of template.fields) {
      const value = data[field.id];

      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: field.id,
          message: `${field.label} is required`,
          code: 'REQUIRED_FIELD'
        });
        continue;
      }

      // Skip validation for optional empty fields
      if (!field.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      const typeValidation = validateFieldType_(field, value);
      if (!typeValidation.ok) {
        errors.push({
          field: field.id,
          message: typeValidation.message,
          code: 'TYPE_MISMATCH'
        });
      }

      // Custom validation rules
      if (field.validation) {
        const customValidation = validateFieldCustomRules_(field, value);
        if (!customValidation.ok) {
          errors.push({
            field: field.id,
            message: customValidation.message,
            code: 'VALIDATION_FAILED'
          });
        }
      }
    }

    // Check for extra fields not in template
    if (template.strictMode) {
      const allowedFields = new Set(template.fields.map(f => f.id));
      for (const key of Object.keys(data)) {
        if (!allowedFields.has(key)) {
          errors.push({
            field: key,
            message: `Unknown field: ${key}`,
            code: 'UNKNOWN_FIELD'
          });
        }
      }
    }

    const valid = errors.length === 0;

    Logger.log(`Template validation ${valid ? 'passed' : 'failed'} for ${templateId}: ${errors.length} errors`);

    return Ok({
      valid: valid,
      errors: errors,
      templateId: templateId
    });

  } catch (err) {
    Logger.log('TemplateService_validateData error: ' + err);
    return Err('INTERNAL_ERROR', 'Failed to validate data: ' + err.message);
  }
}

/**
 * Migrate data from one template version to another
 *
 * @param {Object} data - Data to migrate
 * @param {string} fromTemplateId - Source template ID
 * @param {string} toTemplateId - Target template ID
 * @returns {Object} Result envelope with migrated data
 */
function TemplateService_migrateData(data, fromTemplateId, toTemplateId) {
  try {
    if (!data || !fromTemplateId || !toTemplateId) {
      return Err('BAD_INPUT', 'Missing required parameters: data, fromTemplateId, toTemplateId');
    }

    const fromTemplate = findTemplate_(fromTemplateId);
    const toTemplate = findTemplate_(toTemplateId);

    if (!fromTemplate || !toTemplate) {
      return Err('NOT_FOUND', 'Template not found');
    }

    // If templates are the same, no migration needed
    if (fromTemplateId === toTemplateId) {
      return Ok({ data: data, migrated: false });
    }

    // Apply migration function if defined
    if (toTemplate.migration && typeof toTemplate.migration === 'function') {
      const migratedData = toTemplate.migration(data, fromTemplate);
      Logger.log(`Data migrated from ${fromTemplateId} to ${toTemplateId}`);
      return Ok({ data: migratedData, migrated: true });
    }

    // Default migration: copy matching fields
    const migratedData = {};
    const toFieldIds = new Set(toTemplate.fields.map(f => f.id));

    for (const [key, value] of Object.entries(data)) {
      if (toFieldIds.has(key)) {
        migratedData[key] = value;
      }
    }

    // Apply default values for new required fields
    for (const field of toTemplate.fields) {
      if (field.required && !(field.id in migratedData)) {
        migratedData[field.id] = field.defaultValue || '';
      }
    }

    Logger.log(`Data migrated (default) from ${fromTemplateId} to ${toTemplateId}`);

    return Ok({ data: migratedData, migrated: true });

  } catch (err) {
    Logger.log('TemplateService_migrateData error: ' + err);
    return Err('INTERNAL_ERROR', 'Failed to migrate data: ' + err.message);
  }
}

/**
 * Render template as HTML form
 *
 * @param {string} templateId - Template ID
 * @param {Object} [data] - Pre-filled data
 * @param {string} [locale] - Optional locale
 * @returns {Object} Result envelope with HTML string
 */
function TemplateService_renderForm(templateId, data, locale) {
  try {
    const templateResult = TemplateService_getTemplate(templateId, locale);
    if (!templateResult.ok) {
      return templateResult;
    }

    const template = templateResult.value.template;
    data = data || {};

    const html = [];
    html.push('<form class="template-form" data-template-id="' + template.id + '">');

    for (const field of template.fields) {
      html.push(renderField_(field, data[field.id], locale));
    }

    html.push('</form>');

    return Ok({
      html: html.join('\n'),
      templateId: templateId
    });

  } catch (err) {
    Logger.log('TemplateService_renderForm error: ' + err);
    return Err('INTERNAL_ERROR', 'Failed to render form: ' + err.message);
  }
}

/**
 * Compose a new template from multiple base templates
 *
 * @param {Object} params - Composition parameters
 * @param {string} params.id - New template ID
 * @param {string} params.label - Template label
 * @param {Array<string>} params.composedFrom - Array of template IDs to compose
 * @param {Array<Object>} [params.additionalFields] - Additional fields to add
 * @returns {Object} Result envelope with composed template
 */
function TemplateService_composeTemplate(params) {
  try {
    if (!params || !params.id || !params.composedFrom || !Array.isArray(params.composedFrom)) {
      return Err('BAD_INPUT', 'Missing required parameters: id, composedFrom');
    }

    const composedTemplate = {
      id: params.id,
      label: params.label || params.id,
      description: params.description || 'Composed template',
      category: params.category || 'custom',
      composedFrom: params.composedFrom,
      fields: []
    };

    // Merge fields from all source templates
    const fieldIds = new Set();

    for (const sourceId of params.composedFrom) {
      const source = findTemplate_(sourceId);
      if (!source) {
        return Err('NOT_FOUND', `Source template not found: ${sourceId}`);
      }

      for (const field of source.fields) {
        // Avoid duplicate fields
        if (!fieldIds.has(field.id)) {
          composedTemplate.fields.push({ ...field }); // Deep copy
          fieldIds.add(field.id);
        }
      }
    }

    // Add additional fields if provided
    if (params.additionalFields) {
      for (const field of params.additionalFields) {
        if (!fieldIds.has(field.id)) {
          composedTemplate.fields.push(field);
          fieldIds.add(field.id);
        }
      }
    }

    Logger.log(`Composed template ${params.id} from ${params.composedFrom.join(', ')}`);

    return Ok({
      template: composedTemplate
    });

  } catch (err) {
    Logger.log('TemplateService_composeTemplate error: ' + err);
    return Err('INTERNAL_ERROR', 'Failed to compose template: ' + err.message);
  }
}

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
 * Find template by ID
 *
 * @param {string} templateId - Template ID
 * @returns {Object|null} Template object or null
 * @private
 */
function findTemplate_(templateId) {
  const templates = TEMPLATES || [];
  return templates.find(t => t.id === templateId) || null;
}

/**
 * Resolve template inheritance chain
 *
 * @param {Object} template - Template object
 * @returns {Object} Resolved template with inherited fields
 * @private
 */
function resolveTemplateInheritance_(template) {
  // If no inheritance, return as-is
  if (!template.extendsFrom) {
    return { ...template };
  }

  // Get parent template
  const parent = findTemplate_(template.extendsFrom);
  if (!parent) {
    Logger.log(`Warning: Parent template not found: ${template.extendsFrom}`);
    return { ...template };
  }

  // Recursively resolve parent inheritance
  const resolvedParent = resolveTemplateInheritance_(parent);

  // Merge parent and child
  const resolved = {
    ...resolvedParent,
    ...template,
    fields: [
      ...(resolvedParent.fields || []),
      ...(template.fields || [])
    ]
  };

  // Remove duplicate fields (child overrides parent)
  const fieldMap = new Map();
  for (const field of resolved.fields) {
    fieldMap.set(field.id, field);
  }
  resolved.fields = Array.from(fieldMap.values());

  return resolved;
}

/**
 * Validate field type
 *
 * @param {Object} field - Field definition
 * @param {*} value - Value to validate
 * @returns {Object} Validation result
 * @private
 */
function validateFieldType_(field, value) {
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'tel':
      if (typeof value !== 'string') {
        return { ok: false, message: `${field.label} must be a string` };
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { ok: false, message: `${field.label} must be a number` };
      }
      break;

    case 'date':
    case 'time':
    case 'datetime':
      // Accept ISO date strings or Date objects
      if (typeof value !== 'string' && !(value instanceof Date)) {
        return { ok: false, message: `${field.label} must be a date` };
      }
      break;

    case 'url':
      if (typeof value !== 'string' || !value.match(/^https?:\/\/.+/)) {
        return { ok: false, message: `${field.label} must be a valid URL` };
      }
      break;

    case 'checkbox':
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { ok: false, message: `${field.label} must be true or false` };
      }
      break;

    case 'select':
    case 'radio':
      if (!field.options || !field.options.includes(value)) {
        return { ok: false, message: `${field.label} must be one of: ${field.options.join(', ')}` };
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return { ok: false, message: `${field.label} must be an array` };
      }
      break;

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        return { ok: false, message: `${field.label} must be an object` };
      }
      break;
  }

  return { ok: true };
}

/**
 * Validate field custom rules
 *
 * @param {Object} field - Field definition
 * @param {*} value - Value to validate
 * @returns {Object} Validation result
 * @private
 */
function validateFieldCustomRules_(field, value) {
  const validation = field.validation;

  // Min length
  if (validation.minLength !== undefined && value.length < validation.minLength) {
    return {
      ok: false,
      message: `${field.label} must be at least ${validation.minLength} characters`
    };
  }

  // Max length
  if (validation.maxLength !== undefined && value.length > validation.maxLength) {
    return {
      ok: false,
      message: `${field.label} must be at most ${validation.maxLength} characters`
    };
  }

  // Min value
  if (validation.min !== undefined && value < validation.min) {
    return {
      ok: false,
      message: `${field.label} must be at least ${validation.min}`
    };
  }

  // Max value
  if (validation.max !== undefined && value > validation.max) {
    return {
      ok: false,
      message: `${field.label} must be at most ${validation.max}`
    };
  }

  // Pattern matching
  if (validation.pattern) {
    const regex = new RegExp(validation.pattern);
    if (!regex.test(value)) {
      return {
        ok: false,
        message: validation.patternMessage || `${field.label} format is invalid`
      };
    }
  }

  // Custom validation function
  if (validation.custom && typeof validation.custom === 'function') {
    const result = validation.custom(value);
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}

/**
 * Render a single field as HTML
 *
 * @param {Object} field - Field definition
 * @param {*} value - Pre-filled value
 * @param {string} locale - Locale for labels
 * @returns {string} HTML string
 * @private
 */
function renderField_(field, value, locale) {
  const label = field.label || field.id;
  const required = field.required ? 'required' : '';
  const placeholder = field.placeholder || '';

  value = value !== undefined ? value : (field.defaultValue || '');

  let input = '';

  switch (field.type) {
    case 'text':
    case 'email':
    case 'tel':
    case 'url':
    case 'date':
    case 'time':
      input = `<input type="${field.type}" name="${field.id}" value="${escapeHtml_(value)}" placeholder="${placeholder}" ${required} />`;
      break;

    case 'number':
      const min = field.validation?.min !== undefined ? `min="${field.validation.min}"` : '';
      const max = field.validation?.max !== undefined ? `max="${field.validation.max}"` : '';
      input = `<input type="number" name="${field.id}" value="${value}" ${min} ${max} ${required} />`;
      break;

    case 'textarea':
      input = `<textarea name="${field.id}" placeholder="${placeholder}" ${required}>${escapeHtml_(value)}</textarea>`;
      break;

    case 'checkbox':
      const checked = value ? 'checked' : '';
      input = `<input type="checkbox" name="${field.id}" ${checked} ${required} />`;
      break;

    case 'select':
      const options = (field.options || []).map(opt => {
        const selected = opt === value ? 'selected' : '';
        return `<option value="${escapeHtml_(opt)}" ${selected}>${escapeHtml_(opt)}</option>`;
      }).join('\n');
      input = `<select name="${field.id}" ${required}>${options}</select>`;
      break;

    default:
      input = `<input type="text" name="${field.id}" value="${escapeHtml_(value)}" ${required} />`;
  }

  return `
    <div class="form-field" data-field-id="${field.id}">
      <label for="${field.id}">${escapeHtml_(label)}${field.required ? ' *' : ''}</label>
      ${input}
      ${field.helpText ? `<small class="help-text">${escapeHtml_(field.helpText)}</small>` : ''}
    </div>
  `;
}

/**
 * Escape HTML special characters
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 * @private
 */
function escapeHtml_(str) {
  if (typeof str !== 'string') return String(str);

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * API endpoint: Get template
 *
 * @param {Object} params
 * @param {string} params.templateId - Template ID
 * @param {string} [params.locale] - Optional locale
 * @returns {Object} Result envelope
 */
function api_getTemplate(params) {
  return TemplateService_getTemplate(params.templateId, params.locale);
}

/**
 * API endpoint: List templates
 *
 * @param {Object} params - Optional parameters
 * @returns {Object} Result envelope
 */
function api_listTemplates(params) {
  return TemplateService_listTemplates(params);
}

/**
 * API endpoint: Validate data
 *
 * @param {Object} params
 * @param {string} params.templateId - Template ID
 * @param {Object} params.data - Data to validate
 * @param {string} [params.locale] - Optional locale
 * @returns {Object} Result envelope
 */
function api_validateTemplateData(params) {
  return TemplateService_validateData(params.templateId, params.data, params.locale);
}
