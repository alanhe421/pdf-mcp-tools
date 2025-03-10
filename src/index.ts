#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
// Create server instance
const server = new McpServer({
  name: "pdf-server",
  version: "0.0.1",
});

// Register PDF tools
server.tool(
  "remove-pdf-pages",
  "Remove pages from a PDF",
  {
    pdfPath: z.string().describe("The path to the PDF file"),
    pageNumbers: z.array(z.number()).describe("The page numbers to remove from the PDF (1-indexed)"),
  },
  async ({ pdfPath, pageNumbers }) => {
    try {
      // Decode base64 PDF
      const pdfData = fs.readFileSync(pdfPath, { encoding: 'base64' });
      
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(pdfData);
      
      // Get total number of pages
      const totalPages = pdfDoc.getPageCount();
      
      // Validate page numbers
      const invalidPages = pageNumbers.filter(num => num < 1 || num > totalPages);
      if (invalidPages.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Invalid page numbers: ${invalidPages.join(', ')}. The document has ${totalPages} pages.`,
            },
          ],
        };
      }
      
      // Sort page numbers in descending order to avoid index shifting when removing pages
      const sortedPageNumbers = [...pageNumbers].sort((a, b) => b - a);
      
      // Remove pages
      for (const pageNum of sortedPageNumbers) {
        // PDF.js uses 0-based indexing, but our API uses 1-based indexing
        pdfDoc.removePage(pageNum - 1);
      }
      
      // Serialize the modified PDF to base64
      const modifiedPdfBytes = await pdfDoc.save();
      const modifiedPdfBase64 = Buffer.from(modifiedPdfBytes).toString('base64');
      
      fs.writeFileSync(pdfPath, modifiedPdfBase64, { encoding: 'base64' });
      return {
        content: [
          {
            type: "text",
            text: `Successfully removed ${pageNumbers.length} pages from the PDF.`,
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error processing PDF: ${errorMessage}`,
          },
        ],
      };
    }
  },
);


async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PDF MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});