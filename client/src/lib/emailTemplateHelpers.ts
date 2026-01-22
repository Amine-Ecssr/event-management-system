import { SAMPLE_EVENT } from './emailTemplateConstants';

export function insertVariable(variable: string, quillRef: any) {
  const editor = quillRef.current?.getEditor();
  if (editor) {
    const range = editor.getSelection();
    if (range) {
      editor.insertText(range.index, variable);
      editor.setSelection(range.index + variable.length);
    }
  }
}

export function replaceVariables(template: string) {
  let result = template;
  Object.entries(SAMPLE_EVENT).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  return result;
}

export function generatePreviewHtml(
  body: string,
  brandColor: string,
  textColor: string,
  bgColor: string,
  fontFamily: string,
  fontSize: string,
  requirementsHtml?: string
) {
  let processedBody = replaceVariables(body);
  
  // If requirementsHtml is provided and body contains {{requirements}}, replace it inline
  if (requirementsHtml && processedBody.includes('{{requirements}}')) {
    processedBody = processedBody.replace(/\{\{requirements\}\}/g, requirementsHtml);
  }
  
  return `
    <div style="font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor}; background-color: ${bgColor}; padding: 24px; border-radius: 8px; border: 2px solid ${brandColor};">
      ${processedBody}
    </div>
  `;
}

export function generateRequirementsPreviewHtml(
  title: string,
  reqBrandColor: string,
  reqTextColor: string,
  reqBgColor: string,
  reqFontFamily: string,
  reqFontSize: string
) {
  return `
    <div style="font-family: ${reqFontFamily}; font-size: ${reqFontSize}; color: ${reqTextColor}; background-color: ${reqBgColor}; padding: 16px; border-radius: 4px;">
      <h2 style="color: ${reqBrandColor}; font-size: 18px; margin-bottom: 12px;">${title}</h2>
      <ul style="margin: 12px 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">
          <strong>Submit Event Documentation</strong>
          <br />
          <span style="color: #666; font-size: 14px;">Provide a comprehensive report covering key highlights, attendance figures, and outcomes within 5 business days.</span>
        </li>
        <li style="margin-bottom: 8px;">
          <strong>Coordinate Logistics</strong>
          <br />
          <span style="color: #666; font-size: 14px;">Ensure all venue, catering, and technical requirements are confirmed at least 2 weeks before the event date.</span>
        </li>
        <li style="margin-bottom: 8px;">
          <strong>Prepare Promotional Materials</strong>
          <br />
          <span style="color: #666; font-size: 14px;">Design and distribute event flyers, social media content, and email announcements to target audience.</span>
        </li>
      </ul>
    </div>
  `;
}

export function generateFooterPreviewHtml(
  footerBody: string,
  footerBrandColor: string,
  footerTextColor: string,
  footerBgColor: string,
  footerFontFamily: string,
  footerFontSize: string
) {
  const processedFooter = replaceVariables(footerBody);
  return `
    <div style="font-family: ${footerFontFamily}; font-size: ${footerFontSize}; color: ${footerTextColor}; background-color: ${footerBgColor}; padding: 16px; border-radius: 4px; border-top: 2px solid ${footerBrandColor};">
      ${processedFooter}
    </div>
  `;
}

export function generateFullPreview(
  subject: string,
  body: string,
  footer: string,
  brandColor: string,
  textColor: string,
  bgColor: string,
  fontFamily: string,
  fontSize: string,
  requirementsTitle: string,
  requirementsBrandColor: string,
  requirementsTextColor: string,
  requirementsBgColor: string,
  requirementsFontFamily: string,
  requirementsFontSize: string,
  footerBrandColor: string,
  footerTextColor: string,
  footerBgColor: string,
  footerFontFamily: string,
  footerFontSize: string,
  showRequirementsLabel: boolean = true,
  showYourMessageLabel: boolean = true
) {
  const requirementsHtml = generateRequirementsPreviewHtml(
    requirementsTitle,
    requirementsBrandColor,
    requirementsTextColor,
    requirementsBgColor,
    requirementsFontFamily,
    requirementsFontSize
  );

  const bodyHtml = generatePreviewHtml(
    body,
    brandColor,
    textColor,
    bgColor,
    fontFamily,
    fontSize,
    body.includes('{{requirements}}') ? requirementsHtml : undefined
  );

  const footerHtml = generateFooterPreviewHtml(
    footer,
    footerBrandColor,
    footerTextColor,
    footerBgColor,
    footerFontFamily,
    footerFontSize
  );

  let previewHtml = `
    <div class="mb-4">
      <p class="text-sm font-medium text-muted-foreground">Subject:</p>
      <p class="text-base font-semibold">${replaceVariables(subject)}</p>
    </div>
    <div class="border-t my-4"></div>
  `;

  if (showYourMessageLabel) {
    previewHtml += `
      <div class="mb-4">
        <p class="text-xs font-semibold text-primary mb-2">YOUR CUSTOM MESSAGE:</p>
        ${bodyHtml}
      </div>
    `;
  } else {
    previewHtml += `<div class="mb-4">${bodyHtml}</div>`;
  }

  // Only show requirements section if NOT using {{requirements}} in message
  if (!body.includes('{{requirements}}')) {
    if (showRequirementsLabel) {
      previewHtml += `
        <div class="border-t my-4"></div>
        <div>
          <p class="text-xs font-semibold text-primary mb-2">REQUIREMENTS (AUTOMATICALLY ADDED):</p>
          ${requirementsHtml}
        </div>
      `;
    } else {
      previewHtml += `<div class="border-t my-4"></div><div>${requirementsHtml}</div>`;
    }
  }

  previewHtml += `
    <div class="border-t my-4"></div>
    <div>
      <p class="text-xs font-semibold text-primary mb-2">FOOTER:</p>
      ${footerHtml}
    </div>
  `;

  return previewHtml;
}
