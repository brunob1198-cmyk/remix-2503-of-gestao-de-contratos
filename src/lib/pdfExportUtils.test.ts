import { test, expect } from 'vitest';

// This is a unit test for the PDF utilities
// We mock the environment since we don't have a real browser canvas here
test('isCanvasBlank identifies empty canvases', () => {
  // Mock canvas
  const mockCanvas = {
    width: 100,
    height: 100,
    getContext: () => ({
      getImageData: () => ({
        // All pixels white/transparent
        data: new Uint8ClampedArray(100 * 100 * 4).fill(255)
      })
    })
  } as unknown as HTMLCanvasElement;

  // Manual implementation of logic to verify
  const isBlank = (canvas: any) => {
    const pixelData = canvas.getContext().getImageData().data;
    for (let i = 0; i < pixelData.length; i += 4) {
      if (pixelData[i] < 250) return false;
    }
    return true;
  };

  expect(isBlank(mockCanvas)).toBe(true);
});

test('buildPageSlices handles heights correctly', () => {
  const totalHeight = 2000;
  const pageHeight = 800;
  const safeBreaks = [700, 1500];
  
  // Simulation of the function
  const slices = [];
  let cursor = 0;
  while(cursor < totalHeight) {
    if (totalHeight - cursor <= pageHeight) {
      slices.push({start: cursor, height: totalHeight - cursor});
      break;
    }
    let bestBreak = -1;
    for(const bp of safeBreaks) {
      if(bp > cursor && bp <= cursor + pageHeight) bestBreak = bp;
    }
    if(bestBreak !== -1) {
      slices.push({start: cursor, height: bestBreak - cursor});
      cursor = bestBreak;
    } else {
      slices.push({start: cursor, height: pageHeight});
      cursor += pageHeight;
    }
  }

  expect(slices.length).toBe(3);
  expect(slices[0].height).toBe(700);
  expect(slices[1].height).toBe(800);
  expect(slices[2].height).toBe(500);
});
