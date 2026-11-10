"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { FORM_SECTIONS, INITIAL_FORM_DATA } from "@/lib/fields";
import { reportInlineError, reportInvalidSubmission } from "@/friction/frictionBus.js";
import {
  getOverallProgress,
  validateAll,
  validateField,
  validateFile,
  validateSection,
} from "@/lib/validation";

// Central application state. Both the NormalForm and a future WizardForm
// read and write through this context, so data survives a UI switch.

const ApplicationContext = createContext(null);

function makeReference() {
  return `AG-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function ApplicationProvider({ children }) {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState({});
  const [currentSection, setCurrentSection] = useState("dashboard");
  const [submission, setSubmission] = useState(null); // { reference, submittedAt }

  const progress = useMemo(() => getOverallProgress(formData), [formData]);

  const status = useMemo(() => {
    if (submission) return "Submitted";
    if (progress.percentage === 0) return "Not started";
    if (progress.percentage === 100) return "Ready to submit";
    return "In progress";
  }, [submission, progress.percentage]);

  const clearFieldError = (section, name) => {
    setErrors((prev) => {
      if (!prev[section] || !prev[section][name]) return prev;
      const next = { ...prev[section] };
      delete next[name];
      return { ...prev, [section]: next };
    });
  };

  const setFieldError = (section, name, message) => {
    setErrors((prev) => {
      const next = { ...(prev[section] || {}) };
      if (message) next[name] = message;
      else delete next[name];
      return { ...prev, [section]: next };
    });
  };

  const updateField = useCallback((section, name, value) => {
    setFormData((prev) => ({ ...prev, [section]: { ...prev[section], [name]: value } }));
    clearFieldError(section, name);
  }, []);

  const blurField = useCallback(
    (section, name) => {
      const message = validateField(section, name, formData);
      setFieldError(section, name, message);
      if (message) reportInlineError(section, name); // metadata only: section and field IDs
    },
    [formData]
  );

  const setDocument = useCallback((key, file) => {
    const message = validateFile(file);
    if (message) {
      setFieldError("documents", key, message);
      reportInlineError("documents", key);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [key]: { name: file.name, size: file.size, type: file.type, file },
      },
    }));
    clearFieldError("documents", key);
  }, []);

  const removeDocument = useCallback((key) => {
    setFormData((prev) => ({ ...prev, documents: { ...prev.documents, [key]: null } }));
  }, []);

  const goToSection = useCallback((section) => {
    setCurrentSection(section);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  // Validates the current section before moving forward.
  const goNext = useCallback(() => {
    const sectionErrors = validateSection(currentSection, formData);
    if (Object.keys(sectionErrors).length > 0) {
      setErrors((prev) => ({ ...prev, [currentSection]: sectionErrors }));
      reportInvalidSubmission({ [currentSection]: Object.keys(sectionErrors) });
      return false;
    }
    const index = FORM_SECTIONS.indexOf(currentSection);
    if (index >= 0 && index < FORM_SECTIONS.length - 1) {
      goToSection(FORM_SECTIONS[index + 1]);
    }
    return true;
  }, [currentSection, formData, goToSection]);

  const goPrevious = useCallback(() => {
    const index = FORM_SECTIONS.indexOf(currentSection);
    goToSection(index > 0 ? FORM_SECTIONS[index - 1] : "dashboard");
  }, [currentSection, goToSection]);

  // Validates every section. Jumps to the first invalid one if needed.
  const submitApplication = useCallback(() => {
    const allErrors = validateAll(formData);
    const firstInvalid = FORM_SECTIONS.find((id) => allErrors[id]);
    if (firstInvalid) {
      setErrors(allErrors);
            reportInvalidSubmission({
       ...Object.fromEntries(Object.entries(allErrors).map(([id, e]) => [id, Object.keys(e)])),
       review: ["submitButton"],
      });
      goToSection(firstInvalid);
      return { ok: false, firstInvalid };
    }
    setSubmission({ reference: makeReference(), submittedAt: new Date().toISOString() });
    setErrors({});
    return { ok: true };
  }, [formData, goToSection]);

  const resetApplication = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setSubmission(null);
    goToSection("dashboard");
  }, [goToSection]);

  const value = {
    formData,
    errors,
    currentSection,
    submission,
    progress,
    status,
    updateField,
    blurField,
    setDocument,
    removeDocument,
    goToSection,
    goNext,
    goPrevious,
    submitApplication,
    resetApplication,
  };

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplication() {
  const context = useContext(ApplicationContext);
  if (!context) throw new Error("useApplication must be used inside ApplicationProvider");
  return context;
}
