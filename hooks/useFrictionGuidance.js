
"use client";

import { useMemo } from "react";

export default function useFrictionGuidance(frictionAnalysis, fieldData) {
    return useMemo(() => {
        const section = fieldData?.section || "";
        const field = fieldData?.field || "";

        const fieldKey = `${section}.${field}`;

        const friction = frictionAnalysis?.fieldFriction?.[fieldKey];

        if (!friction || friction.totalScore < 25) {
            return {
                section,
                field,
                score: friction?.totalScore || 0,
                level: "Low",
                message: "",
                isFriction: false,
            };
        }

        const guidance = {
            personal: {
                fullName: {
                    moderate: "Check your first name and last name carefully before continuing.",
                    high: "Enter your complete name and verify the spelling of each word.",
                },
                phone: {
                    moderate: "Check your phone number digit by digit before moving ahead.",
                    high: "Recheck your phone number, including the country code, to avoid missing or extra digits.",
                },
                email: {
                    moderate: "Check your email format. It should look like name@example.com.",
                    high: "Verify the email address carefully. Check the spelling, @ symbol and domain name.",
                },
                dateOfBirth: {
                    moderate: "Verify that the selected date matches your official date of birth.",
                    high: "Carefully check the day, month and year before continuing.",
                },
                address: {
                    moderate: "Make sure your address includes your house number, street and city.",
                    high: "Check that your complete address includes house number, street, area, city and postal code.",
                },
            },

            employment: {
                employmentType: {
                    moderate: "Choose the employment option that matches your current situation.",
                    high: "Review the available options and select the one that accurately describes your status.",
                },
                organization: {
                    moderate: "Check that you have entered the complete organization name.",
                    high: "Enter the full and correct name of your company, college or university.",
                },
                jobTitle: {
                    moderate: "Make sure your job title correctly describes your current role.",
                    high: "Review your designation and enter your current role clearly.",
                },
                yearsExperience: {
                    moderate: "Check that your experience is entered as a number.",
                    high: "Verify your experience value. Enter a number between 0 and 60.",
                },
            },

            financial: {
                monthlyIncome: {
                    moderate: "Verify that this amount represents your monthly income after tax.",
                    high: "Recheck the monthly amount and make sure it is entered correctly.",
                },
                annualIncome: {
                    moderate: "Check that this value represents your total income for one year.",
                    high: "Verify the yearly income amount and check for extra or missing digits.",
                },
                monthlyExpenses: {
                    moderate: "Review whether you included your regular monthly expenses.",
                    high: "Recheck your monthly expenses, including rent, bills and loan payments.",
                },
                existingLoanAmount: {
                    moderate: "Check your outstanding loan balance. Enter 0 if you have no loans.",
                    high: "Verify the remaining loan amount and make sure it is not confused with the original loan amount.",
                },
                creditScoreRange: {
                    moderate: "Choose the range that matches your latest available credit score.",
                    high: "Review your latest credit score information before selecting a range.",
                },
            },

            documents: {
                identity: {
                    moderate: "Make sure your identity document is valid and clearly readable.",
                    high: "Check that the uploaded identity document is clear, valid and belongs to you.",
                },
                addressProof: {
                    moderate: "Check that your document clearly shows your current address.",
                    high: "Verify that the address proof is readable and shows your current address.",
                },
                incomeProof: {
                    moderate: "Make sure your document clearly supports your income details.",
                    high: "Check that the uploaded income proof is recent and clearly readable.",
                },
            },
        };

        const fieldGuidance = guidance[section]?.[field];

        if (!fieldGuidance) {
            return {
                section,
                field,
                score: friction.totalScore,
                level: friction.level,
                message: "",
                isFriction: false,
            };
        }

        const level = friction.totalScore >= 60 ? "High" : "Moderate";

        const message =
            level === "High"
                ? fieldGuidance.high
                : fieldGuidance.moderate;

        return {
            section,
            field,
            score: friction.totalScore,
            level,
            message,
            isFriction: true,
        };
    }, [
        frictionAnalysis?.fieldFriction,
        fieldData?.section,
        fieldData?.field,
    ]);
}
