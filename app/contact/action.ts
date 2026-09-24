"use server";

import { commerce } from "@/lib/commerce";

type ContactState = {
	success: boolean;
	message: string;
	error?: string;
} | null;

export async function sendContactMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
	const email = formData.get("email");
	const message = formData.get("message");
	const normalizedEmail = typeof email === "string" ? email.trim() : "";
	const normalizedMessage = typeof message === "string" ? message.trim() : "";

	if (
		!normalizedEmail ||
		normalizedEmail.length > 320 ||
		!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
	) {
		return { success: false, message: "", error: "Please enter a valid email address." };
	}

	if (!normalizedMessage || normalizedMessage.length > 10000) {
		return { success: false, message: "", error: "Please enter a message." };
	}

	try {
		await commerce.contactMessageCreate({ email: normalizedEmail, message: normalizedMessage });

		return {
			success: true,
			message: "Thanks for reaching out! Your message has been sent to our support team.",
		};
	} catch {
		return {
			success: false,
			message: "",
			error: "We couldn't send your message right now. Please email help@teebravo.com.",
		};
	}
}
