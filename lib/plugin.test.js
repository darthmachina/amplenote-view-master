import { jest } from "@jest/globals"
import { mockApp, mockPlugin, mockNote } from "./test-helpers.js"

// --------------------------------------------------------------------------------------
describe("This here plugin", () => {
  const plugin = mockPlugin();
  plugin._testEnvironment = true;
  const app = mockApp();

  it("should run some tests", () => {
    expect(true).toBeTruthy();
  })

  it("_sortNotes sorts notes b")
});
