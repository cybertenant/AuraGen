
"use client";

import { useMemo } from "react";

export default function useAdaptiveUI(cognitiveLoad, fieldData) {
    return useMemo(() => {
        const score = cognitiveLoad?.score || 0;

        const currentField = fieldData?.field || "";
        const currentSection = fieldData?.section || "";

        let level = "low";

        if (score >= 60) {
            level = "high";
        } else if (score >= 25) {
            level = "moderate";
        }

        const guidance = {
            personal: {
                fullName: {
                    moderate: "Enter your full name as it appears on official documents.",
                    high: "Enter your first name and last name. Check the spelling before continuing.",
                },
                phone: {
                    moderate: "Enter your active contact number.",
                    high: "Enter your phone number carefully. Check every digit before moving ahead.",
                },
                email: {
                    moderate: "Use an email address you can access.",
                    high: "Enter a valid email address, for example: name@example.com.",
                },
                dateOfBirth: {
                    moderate: "Select your date of birth.",
                    high: "Choose your birth date from the date selector and verify it.",
                },
                address: {
                    moderate: "Enter your current residential address.",
                    high: "Enter your house number, street, area and city.",
                },
            },

            employment: {
                employmentType: {
                    moderate: "Choose the option that best describes your current status.",
                    high: "Select Student, Employed or the option that matches your situation.",
                },
                organization: {
                    moderate: "Enter your school, university or company name.",
                    high: "Type the full name of your school, university or organization.",
                },
                jobTitle: {
                    moderate: "Enter your current job title or role.",
                    high: "Enter your designation, for example: Software Developer.",
                },
                yearsExperience: {
                    moderate: "Enter your total years of work experience.",
                    high: "Enter a number between 0 and 60. You can use decimal values.",
                },
            },

            financial: {
                monthlyIncome: {
                    moderate: "Enter your monthly income after tax.",
                    high: "Enter the amount you receive in one month, after tax.",
                },
                annualIncome: {
                    moderate: "Enter your total income for one year.",
                    high: "Enter your yearly income. Check the amount before continuing.",
                },
                monthlyExpenses: {
                    moderate: "Include your regular monthly expenses.",
                    high: "Add monthly rent, bills, subscriptions and loan payments.",
                },
                existingLoanAmount: {
                    moderate: "Enter your current outstanding loan amount.",
                    high: "Enter your existing loan amount. Enter 0 if you have no loans.",
                },
                creditScoreRange: {
                    moderate: "Select the credit score range that applies to you.",
                    high: "Choose the range matching your latest available credit score.",
                },
            },

            documents: {
                identity: {
                    moderate: "Upload a valid identity document.",
                    high: "Choose your passport, driver's license or national ID.",
                },
                addressProof: {
                    moderate: "Upload a recent document showing your address.",
                    high: "Choose a recent utility bill or bank statement.",
                },
                incomeProof: {
                    moderate: "Upload a document that supports your income details.",
                    high: "Choose a recent payslip, tax return or bank statement.",
                },
            },
        };

        const fieldGuidance =
            guidance[currentSection]?.[currentField];

        let message = "";

        if (fieldGuidance && level === "moderate") {
            message = fieldGuidance.moderate;
        } else if (fieldGuidance && level === "high") {
            message = fieldGuidance.high;
        }

        return {
            level,
            section: currentSection,
            field: currentField,
            message,
            isAdaptive: Boolean(message),
        };
    }, [
        cognitiveLoad?.score,
        fieldData?.section,
        fieldData?.field,
    ]);
}
