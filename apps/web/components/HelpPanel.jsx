"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { reportHelpOpened } from "@/friction/frictionBus.js";

const HELP_TEXT = {
  personal: [
    "Use your name exactly as it appears on your identity document.",
    "You must be 18 or older to apply.",
    "Enter a phone number with 10 to 15 digits. Include the country code if you are outside your home country.",
  ],
  employment: [
    "Pick the option that best describes your main source of income.",
    "Students only need to give their school or university.",
    "Years of experience can include part years, such as 2.5.",
  ],
  financial: [
    "Enter amounts as numbers only, without commas or currency symbols.",
    "Annual income should be at least your monthly income.",
    "Enter 0 for existing loans if you have none.",
  ],
  documents: [
    "Accepted formats are PDF, JPG and PNG, up to 5 MB each.",
    "Make sure the whole document is visible and the text is readable.",
    "Address proof should be from the last 3 months.",
  ],
  review: [
    "Use the Edit buttons to fix any section, then come back here.",
    "Fields marked Not provided must be completed before you can submit.",
  ],
};

// A small collapsible help box. Opening it is reported to the Friction Engine
// as a help interaction for the current section (no content is sent).
export default function HelpPanel({ sectionId }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    if (!open) reportHelpOpened(sectionId);
    setOpen((value) => !value);
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
        {open ? "Hide help" : "Need help with this step?"}
      </button>
      {open ? (
        <ul className="mt-2 list-disc space-y-1 rounded-lg bg-blue-50 py-3 pl-8 pr-4 text-sm text-slate-700">
          {(HELP_TEXT[sectionId] || []).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
