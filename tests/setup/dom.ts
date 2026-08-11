import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Without this, a component from one test leaks into the next one's queries.
afterEach(cleanup);
