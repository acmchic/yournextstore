"use client";

import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { useActionState } from "react";
import { sendContactMessage } from "@/app/contact/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContactForm() {
	const [state, action, isPending] = useActionState(sendContactMessage, null);

	if (state?.success) {
		return (
			<div className="w-full rounded-lg border border-border bg-secondary/30 p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
				<div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-full bg-foreground/5">
					<CheckIcon className="h-6 w-6" />
				</div>
				<h2 className="text-2xl font-medium tracking-tight">Message sent</h2>
				<p className="mt-2 text-muted-foreground" role="status">
					{state.message}
				</p>
			</div>
		);
	}

	return (
		<form action={action} className="w-full space-y-5">
			<div className="space-y-2">
				<Label htmlFor="contact-email">
					Email <span aria-hidden="true">*</span>
				</Label>
				<Input
					id="contact-email"
					type="email"
					name="email"
					autoComplete="email"
					placeholder="you@example.com"
					required
					maxLength={320}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="contact-message">
					Message <span aria-hidden="true">*</span>
				</Label>
				<Textarea
					id="contact-message"
					name="message"
					placeholder="How can we help?"
					required
					maxLength={10000}
					rows={7}
				/>
			</div>
			<Button type="submit" disabled={isPending} size="lg" className="w-full sm:w-auto">
				{isPending ? "Sending…" : "Send message"}
				{!isPending && <ArrowRightIcon className="h-4 w-4" />}
			</Button>
			{state?.error && (
				<p className="text-sm text-destructive" role="alert">
					{state.error}
				</p>
			)}
		</form>
	);
}
