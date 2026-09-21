/**
 * Cognora Architecture PDF Generation Script
 * 
 * Compiles the comprehensive Cognora System Architecture Markdown documentation
 * into an executive, publication-grade HTML print layout and renders it to PDF
 * via Google Chrome headless print-to-pdf.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const docsDir = path.resolve(__dirname);
const mdPath = path.join(docsDir, 'COGNORA_SYSTEM_ARCHITECTURE.md');
const htmlPath = path.join(docsDir, 'print_doc.html');
const pdfPath = path.join(docsDir, 'COGNORA_SYSTEM_ARCHITECTURE.pdf');

console.log('[COGNORA][PDF] Reading Markdown source from:', mdPath);
const markdown = fs.readFileSync(mdPath, 'utf8');

// Basic Markdown to HTML converter tailored for this technical document
function convertMarkdownToHtml(md) {
  let html = '';
  const lines = md.split('\n');
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeContent = '';
  let inTable = false;
  let tableRows = [];
  let inList = false;

  function flushTable() {
    if (!inTable) return '';
    let out = '<div class="table-container"><table>\n';
    tableRows.forEach((row, idx) => {
      const isHeader = idx === 0;
      const tag = isHeader ? 'th' : 'td';
      out += '  <tr>\n';
      row.forEach(cell => {
        out += `    <${tag}>${cell.trim()}</${tag}>\n`;
      });
      out += '  </tr>\n';
    });
    out += '</table></div>\n';
    inTable = false;
    tableRows = [];
    return out;
  }

  function flushList() {
    if (!inList) return '';
    inList = false;
    return '</ul>\n';
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code block toggle
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += flushTable();
        html += flushList();
        html += `<pre class="code-block language-${codeBlockLang || 'text'}"><code>${escapeHtml(codeContent)}</code></pre>\n`;
        inCodeBlock = false;
        codeBlockLang = '';
        codeContent = '';
      } else {
        html += flushTable();
        html += flushList();
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeContent = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line;
      continue;
    }

    // Horizontal Rule
    if (line.trim() === '---') {
      html += flushTable();
      html += flushList();
      html += '<hr class="section-divider"/>\n';
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      html += flushTable();
      html += flushList();
      html += `<h1 class="doc-h1">${formatInline(line.slice(2))}</h1>\n`;
      continue;
    }
    if (line.startsWith('## ')) {
      html += flushTable();
      html += flushList();
      html += `<h2 class="doc-h2">${formatInline(line.slice(3))}</h2>\n`;
      continue;
    }
    if (line.startsWith('### ')) {
      html += flushTable();
      html += flushList();
      html += `<h3 class="doc-h3">${formatInline(line.slice(4))}</h3>\n`;
      continue;
    }
    if (line.startsWith('#### ')) {
      html += flushTable();
      html += flushList();
      html += `<h4 class="doc-h4">${formatInline(line.slice(5))}</h4>\n`;
      continue;
    }

    // Table rows
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      html += flushList();
      const rawCols = line.trim().slice(1, -1).split('|');
      // Skip delimiter line (e.g. |---|---|)
      if (rawCols.every(col => /^[\s:-]+$/.test(col))) {
        continue;
      }
      inTable = true;
      tableRows.push(rawCols.map(c => formatInline(c)));
      continue;
    } else if (inTable) {
      html += flushTable();
    }

    // Unordered list
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      html += flushTable();
      if (!inList) {
        html += '<ul class="doc-list">\n';
        inList = true;
      }
      html += `  <li>${formatInline(line.trim().slice(2))}</li>\n`;
      continue;
    } else if (inList && !line.trim().startsWith('- ') && !line.trim().startsWith('* ') && line.trim().length > 0 && !/^\d+\./.test(line.trim())) {
      // Continuation of list or nested
    } else if (inList) {
      html += flushList();
    }

    // Empty line
    if (!line.trim()) {
      html += flushTable();
      html += flushList();
      continue;
    }

    // Regular paragraph
    html += flushTable();
    html += flushList();
    html += `<p class="doc-p">${formatInline(line)}</p>\n`;
  }

  html += flushTable();
  html += flushList();
  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatInline(str) {
  return str
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[IMPLEMENTED\]/g, '<span class="badge badge-implemented">IMPLEMENTED</span>')
    .replace(/\[PARTIALLY IMPLEMENTED\]/g, '<span class="badge badge-partial">PARTIALLY IMPLEMENTED</span>')
    .replace(/\[EXPERIMENTAL\]/g, '<span class="badge badge-experimental">EXPERIMENTAL</span>')
    .replace(/\[PLANNED\]/g, '<span class="badge badge-planned">PLANNED</span>')
    .replace(/\[LEGACY\]/g, '<span class="badge badge-legacy">LEGACY</span>')
    .replace(/\[DEPRECATED\]/g, '<span class="badge badge-deprecated">DEPRECATED</span>');
}

const bodyHtml = convertMarkdownToHtml(markdown);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>COGNORA: Complete System Architecture & Technical Documentation</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 14mm 16mm 14mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 8pt;
        color: #64748b;
      }
      @top-right {
        content: "COGNORA System Architecture";
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.55;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Typography */
    .doc-h1 {
      font-size: 16pt;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 4px;
      margin-top: 24pt;
      margin-bottom: 10pt;
      page-break-after: avoid;
    }

    .doc-h2 {
      font-size: 13pt;
      font-weight: 600;
      color: #1e293b;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 3px;
      margin-top: 18pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
    }

    .doc-h3 {
      font-size: 11pt;
      font-weight: 600;
      color: #0369a1;
      margin-top: 14pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }

    .doc-h4 {
      font-size: 10pt;
      font-weight: 600;
      color: #334155;
      margin-top: 10pt;
      margin-bottom: 4pt;
      page-break-after: avoid;
    }

    .doc-p {
      margin-top: 0;
      margin-bottom: 7pt;
      text-align: justify;
    }

    .doc-list {
      margin-top: 0;
      margin-bottom: 8pt;
      padding-left: 18pt;
    }

    .doc-list li {
      margin-bottom: 3pt;
    }

    .section-divider {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 16pt 0;
    }

    /* Badges */
    .badge {
      display: inline-block;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 1px 5px;
      border-radius: 3px;
      vertical-align: middle;
      margin-left: 4px;
    }
    .badge-implemented {
      background-color: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }
    .badge-partial {
      background-color: #fef9c3;
      color: #a16207;
      border: 1px solid #fde047;
    }
    .badge-experimental {
      background-color: #f3e8ff;
      color: #7e22ce;
      border: 1px solid #d8b4fe;
    }
    .badge-planned {
      background-color: #e0f2fe;
      color: #0369a1;
      border: 1px solid #7dd3fc;
    }
    .badge-legacy {
      background-color: #ffedd5;
      color: #c2410c;
      border: 1px solid #fdba74;
    }
    .badge-deprecated {
      background-color: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
    }

    /* Tables */
    .table-container {
      width: 100%;
      margin: 10pt 0;
      page-break-inside: avoid;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
      text-align: left;
      padding: 5pt 7pt;
      border: 1px solid #cbd5e1;
    }

    td {
      padding: 4pt 7pt;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Code Blocks */
    .code-block {
      background-color: #0f172a;
      color: #f8fafc;
      font-family: Consolas, "Fira Code", Monaco, monospace;
      font-size: 8pt;
      line-height: 1.45;
      padding: 8pt 10pt;
      border-radius: 4px;
      margin: 8pt 0;
      page-break-inside: avoid;
      white-space: pre-wrap;
      word-break: break-all;
      border-left: 3px solid #38bdf8;
    }

    .inline-code {
      font-family: Consolas, "Fira Code", Monaco, monospace;
      font-size: 8.5pt;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 1px 4px;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
    }

    /* Header Banner */
    .header-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 20pt;
      border-radius: 6px;
      margin-bottom: 20pt;
      page-break-inside: avoid;
    }
    .header-banner h1 {
      margin: 0;
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #38bdf8;
    }
    .header-banner .subtitle {
      margin-top: 4pt;
      font-size: 12pt;
      color: #94a3b8;
      font-weight: 500;
    }
    .header-banner .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6pt;
      margin-top: 14pt;
      font-size: 8.5pt;
      border-top: 1px solid #334155;
      padding-top: 10pt;
    }
    .header-banner .meta-item strong {
      color: #cbd5e1;
    }

    /* Page Breaks */
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

<div class="header-banner">
  <h1>COGNORA</h1>
  <div class="subtitle">Complete System Architecture &amp; Technical Documentation</div>
  <div class="meta-grid">
    <div class="meta-item"><strong>Classification:</strong> Authoritative Technical Reference</div>
    <div class="meta-item"><strong>Target Audience:</strong> Systems Engineers &amp; Core Architects</div>
    <div class="meta-item"><strong>Repository:</strong> codenora-monorepo (codenora-app)</div>
    <div class="meta-item"><strong>Baseline Git Commit:</strong> ef503ff9 (Visual Reasoning 5.0)</div>
    <div class="meta-item"><strong>Verification Status:</strong> 100% Inspected from Active Source</div>
    <div class="meta-item"><strong>Publication Date:</strong> September 2026</div>
  </div>
</div>

${bodyHtml}

</body>
</html>
`;

console.log('[COGNORA][PDF] Writing compiled HTML to:', htmlPath);
fs.writeFileSync(htmlPath, fullHtml, 'utf8');

console.log('[COGNORA][PDF] Launching Chrome headless to render PDF...');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const { spawnSync } = require('child_process');

try {
  const result = spawnSync(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--run-all-compositor-stages-before-draw',
    `--print-to-pdf=${pdfPath}`,
    htmlPath
  ], { stdio: 'inherit' });

  if (fs.existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    console.log(`[COGNORA][PDF] PDF Generated Successfully! File size: ${(stats.size / 1024).toFixed(1)} KB`);
  } else {
    console.error('[COGNORA][PDF] Error: PDF was not generated at expected path.');
  }
} catch (err) {
  console.error('[COGNORA][PDF] Execution failed:', err.message);
}
