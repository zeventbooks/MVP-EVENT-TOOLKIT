/**
 * Form Service
 *
 * Centralizes all Google Forms-related operations:
 * - List available form templates
 * - Create forms from templates
 * - Generate shortlinks for forms
 * - Form template management
 *
 * Design principles:
 * - Encapsulates Google Forms API interactions
 * - Provides template-based form creation
 * - Links forms to events
 * - Handles response spreadsheet creation
 *
 * @module FormService
 */

// === Template Operations ==================================================

/**
 * List all available form templates
 *
 * @returns {object} Result envelope with template list
 */
function FormService_listTemplates() {
  const templates = listFormTemplates_();
  return Ok({ templates });
}

/**
 * Get form template by type
 *
 * @param {string} templateType - Template type identifier
 * @returns {object|null} Template definition or null
 */
function FormService_getTemplate(templateType) {
  return findFormTemplate_(templateType);
}

// === Form Creation ========================================================

/**
 * Create Google Form from template
 *
 * @param {object} params - Form creation parameters
 * @param {string} params.templateType - Template type
 * @param {string} [params.eventName] - Event name for form title
 * @param {string} [params.eventId] - Event ID to link form to
 * @param {string} [params.tenantId] - Tenant ID
 * @returns {object} Result envelope with form details
 */
function FormService_createFromTemplate(params) {
  if (!params || typeof params !== 'object') {
    return Err(ERR.BAD_INPUT, 'Missing payload');
  }

  const { templateType, eventName, eventId } = params;

  if (!templateType) return Err(ERR.BAD_INPUT, 'Missing templateType');

  const template = FormService_getTemplate(templateType);
  if (!template) {
    return Err(ERR.BAD_INPUT, `Unknown template type: ${templateType}`);
  }

  try {
    // Create the form
    const formTitle = eventName
      ? `${eventName} - ${template.label}`
      : template.label;
    const form = FormApp.create(formTitle);

    form.setDescription(template.description);
    form.setCollectEmail(true);
    form.setLimitOneResponsePerUser(false);
    form.setShowLinkToRespondAgain(true);

    // Add questions from template
    FormService_addQuestionsToForm(form, template.questions);

    // Create response spreadsheet
    const responseSheet = SpreadsheetApp.create(`${formTitle} - Responses`);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, responseSheet.getId());

    const formId = form.getId();
    const editUrl = form.getEditUrl();
    const publishedUrl = form.getPublishedUrl();
    const responseSheetUrl = responseSheet.getUrl();

    diag_('info', 'FormService_createFromTemplate', 'created',
      { formId, templateType, eventId });

    return Ok({
      formId,
      editUrl,
      publishedUrl,
      responseSheetUrl,
      templateType,
      eventId: eventId || ''
    });

  } catch (e) {
    diag_('error', 'FormService_createFromTemplate', 'failed',
      { error: e.toString(), templateType });
    return Err(ERR.INTERNAL, `Failed to create form: ${e.toString()}`);
  }
}

/**
 * Add questions to form based on template
 *
 * @param {Form} form - Google Form object
 * @param {array} questions - Array of question definitions
 */
function FormService_addQuestionsToForm(form, questions) {
  questions.forEach(q => {
    let item;

    switch (q.type) {
      case 'TEXT':
        item = form.addTextItem();
        item.setTitle(q.title);
        if (q.required) item.setRequired(true);
        break;

      case 'PARAGRAPH_TEXT':
        item = form.addParagraphTextItem();
        item.setTitle(q.title);
        if (q.required) item.setRequired(true);
        break;

      case 'MULTIPLE_CHOICE':
        item = form.addMultipleChoiceItem();
        item.setTitle(q.title);
        if (q.choices && q.choices.length > 0) {
          item.setChoiceValues(q.choices);
        }
        if (q.required) item.setRequired(true);
        break;

      case 'CHECKBOX':
        item = form.addCheckboxItem();
        item.setTitle(q.title);
        if (q.choices && q.choices.length > 0) {
          item.setChoiceValues(q.choices);
        }
        if (q.required) item.setRequired(true);
        break;

      case 'SCALE':
        item = form.addScaleItem();
        item.setTitle(q.title);
        if (q.scaleMin && q.scaleMax) {
          item.setBounds(q.scaleMin, q.scaleMax);
        }
        if (q.scaleMinLabel) {
          item.setLabels(q.scaleMinLabel, q.scaleMaxLabel || '');
        }
        if (q.required) item.setRequired(true);
        break;

      case 'GRID':
        item = form.addGridItem();
        item.setTitle(q.title);
        if (q.rows && q.columns) {
          item.setRows(q.rows);
          item.setColumns(q.columns);
        }
        if (q.required) item.setRequired(true);
        break;

      case 'DATE':
        item = form.addDateItem();
        item.setTitle(q.title);
        if (q.required) item.setRequired(true);
        break;

      case 'TIME':
        item = form.addTimeItem();
        item.setTitle(q.title);
        if (q.required) item.setRequired(true);
        break;

      default:
        // Default to text item
        item = form.addTextItem();
        item.setTitle(q.title);
        if (q.required) item.setRequired(true);
    }

    // Add help text if provided
    if (item && q.helpText) {
      item.setHelpText(q.helpText);
    }
  });
}

// === Shortlink Operations =================================================

/**
 * Generate shortlink for a form URL
 *
 * @param {object} params - Shortlink parameters
 * @param {string} params.formUrl - Form URL to shorten
 * @param {string} [params.formType] - Form type (signup, feedback, etc.)
 * @param {string} [params.eventId] - Event ID
 * @param {string} [params.tenantId] - Tenant ID
 * @returns {object} Result envelope with shortlink details
 */
function FormService_generateShortlink(params) {
  if (!params || typeof params !== 'object') {
    return Err(ERR.BAD_INPUT, 'Missing payload');
  }

  const { formUrl, formType, eventId } = params;

  if (!formUrl) return Err(ERR.BAD_INPUT, 'Missing formUrl');

  // Validate URL format
  if (!isUrl(formUrl)) {
    return Err(ERR.BAD_INPUT, 'Invalid form URL');
  }

  // Use shortlink service (from Code.gs)
  const shortlinkResult = api_createShortlink({
    targetUrl: formUrl,
    eventId: eventId || '',
    sponsorId: '',
    surface: `form-${formType || 'unknown'}`,
    adminKey: params.adminKey,
    tenantId: params.tenantId
  });

  return shortlinkResult;
}

// === Form Analytics =======================================================

/**
 * Get form response analytics
 * (Future enhancement - analyze form response data)
 *
 * @param {string} formId - Google Form ID
 * @returns {object} Result envelope with form analytics
 */
function FormService_getResponseAnalytics(formId) {
  // TODO: Implement form response analytics
  // - Response count
  // - Completion rate
  * - Average time to complete
  // - Question-by-question breakdown
  // - Response trends over time

  return Ok({
    formId,
    status: 'not_implemented',
    message: 'Form analytics will be implemented in future version'
  });
}

/**
 * Link form to event
 * (Future enhancement - maintain form-event relationships)
 *
 * @param {string} formId - Google Form ID
 * @param {string} eventId - Event ID
 * @param {string} formType - Form type (signup, feedback, survey)
 * @returns {object} Result envelope
 */
function FormService_linkToEvent(formId, eventId, formType) {
  // TODO: Store form-event relationship in database
  // This would allow:
  // - Retrieving all forms for an event
  // - Cross-referencing form responses with event analytics
  // - Automatic form archiving when event ends

  return Ok({
    formId,
    eventId,
    formType,
    status: 'not_implemented',
    message: 'Form-event linking will be implemented in future version'
  });
}
