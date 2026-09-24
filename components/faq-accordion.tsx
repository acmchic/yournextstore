import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type FaqAccordionItem = {
	question: string;
	answer: ReactNode;
};

export function FaqAccordion({ items }: { items: FaqAccordionItem[] }) {
	return (
		<Accordion
			type="single"
			collapsible
			defaultValue={items.length ? "faq-0" : undefined}
			className="border-t border-border"
		>
			{items.map((item, index) => (
				<AccordionItem key={item.question} value={`faq-${index}`} className="border-border">
					<AccordionTrigger className="py-6 text-left text-base font-normal hover:no-underline sm:py-7 sm:text-lg">
						{item.question}
					</AccordionTrigger>
					<AccordionContent className="pb-7 text-base leading-relaxed text-muted-foreground">
						{item.answer}
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
