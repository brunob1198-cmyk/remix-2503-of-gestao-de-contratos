import { expect, test, describe } from "vitest";
import { collectSafeBreakPoints, buildPageSlices } from "../../lib/pdfExportUtils";

describe("PDF Generation Regression Tests", () => {
  test("collectSafeBreakPoints finds all data-pdf-section elements", () => {
    // Mock DOM elements
    const container = document.createElement("div");
    container.style.height = "2000px";
    
    const section1 = document.createElement("div");
    section1.setAttribute("data-pdf-section", "s1");
    section1.style.height = "500px";
    
    const section2 = document.createElement("div");
    section2.setAttribute("data-pdf-section", "s2");
    section2.style.height = "500px";
    
    container.appendChild(section1);
    container.appendChild(section2);
    document.body.appendChild(container);
    
    // We can't easily mock getBoundingClientRect in JSDOM perfectly for layout tests
    // but we can verify the function logic if we mock the rects
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    
    section1.getBoundingClientRect = () => ({ top: 100, bottom: 600, left: 0, right: 100, width: 100, height: 500, x: 0, y: 100 } as any);
    section2.getBoundingClientRect = () => ({ top: 700, bottom: 1200, left: 0, right: 100, width: 100, height: 500, x: 0, y: 700 } as any);
    container.getBoundingClientRect = () => ({ top: 0, bottom: 2000, left: 0, right: 100, width: 100, height: 2000, x: 0, y: 0 } as any);
    
    const breaks = collectSafeBreakPoints(container);
    expect(breaks).toContain(100);
    expect(breaks).toContain(700);
    
    // Cleanup
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    document.body.removeChild(container);
  });

  test("buildPageSlices creates correct slices based on safe breaks", () => {
    const totalHeight = 1500;
    const pageHeight = 600;
    const safeBreaks = [500, 1100];
    
    const slices = buildPageSlices(totalHeight, pageHeight, safeBreaks);
    
    // Slice 1: starts 0, should break at 500 (last break <= 600)
    expect(slices[0]).toEqual({ start: 0, height: 500 });
    // Slice 2: starts 500, end of page is 1100. Break 1100 matches exactly.
    expect(slices[1]).toEqual({ start: 500, height: 600 });
    // Slice 3: starts 1100, remaining is 400.
    expect(slices[2]).toEqual({ start: 1100, height: 400 });
    
    expect(slices.length).toBe(3);
  });
});
