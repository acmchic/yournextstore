export type FAQCategory = {
	id: string;
	title: string;
	questions: { question: string; answer: string }[];
};

export const faqCategories: FAQCategory[] = [
	{
		id: "orders",
		title: "Orders",
		questions: [
			{
				question: "How do I place an order?",
				answer:
					"Browse our products, add items to your cart, and proceed to checkout. You'll be guided through the payment process step by step.",
			},
			{
				question: "Can I modify or cancel my order after placing it?",
				answer:
					"Once an order has been submitted, modifications are generally not possible. If your order hasn't been processed yet, contact us as soon as possible and we'll do our best to accommodate your request.",
			},
			{
				question: "How long does order processing take?",
				answer:
					"Processing and transit are separate parts of delivery. Check the current Shipping Policy and checkout for the latest estimates before ordering.",
			},
			{
				question: "Can I request an invoice for my order?",
				answer:
					"Yes. If you need an invoice, please make sure to provide your billing details during checkout. The invoice will be sent to your email along with the order confirmation.",
			},
			{
				question: "Can I add special instructions to my order?",
				answer:
					"We do not currently advertise an order-notes field. Contact us before purchase if you have a question about an item or order.",
			},
		],
	},
	{
		id: "payments",
		title: "Payments",
		questions: [
			{
				question: "What payment methods do you accept?",
				answer:
					"Checkout accepts card payments. Apple Pay or Google Pay may appear when Stripe and your device or browser support them; available options are shown at checkout.",
			},
			{
				question: "Is my payment information secure?",
				answer:
					"Absolutely. All payments are processed through a PCI-compliant payment provider. We never store your full card details on our servers.",
			},
			{
				question: "My payment failed. What should I do?",
				answer:
					"First, verify that your card details are correct and that you have sufficient funds. If the issue persists, try a different payment method or contact your bank. You can also reach out to us for assistance.",
			},
			{
				question: "When will I be charged?",
				answer:
					"Payment is handled by Stripe Checkout when you complete your purchase. Your order confirmation is sent to the email used at checkout.",
			},
		],
	},
	{
		id: "shipping",
		title: "Shipping & Delivery",
		questions: [
			{
				question: "What are your shipping options?",
				answer:
					"We offer standard and express shipping options. Available methods and estimated delivery times are displayed at checkout based on your location.",
			},
			{
				question: "Do you ship internationally?",
				answer:
					"We currently ship to addresses in the United States. Available service coverage and shipping methods are confirmed at checkout.",
			},
			{
				question: "How can I track my order?",
				answer:
					"Once your order has shipped, you'll receive a confirmation email with a tracking number and a link to track your package in real time.",
			},
			{
				question: "What should I do if my package arrives damaged?",
				answer:
					"If your order arrives damaged, please document the damage with photos and contact us immediately. We'll work with you to resolve the issue as quickly as possible.",
			},
			{
				question: "Can I combine multiple orders to save on shipping?",
				answer:
					"Separate orders are processed separately. Add the items you want to one cart so the current shipping cost is calculated together at checkout.",
			},
		],
	},
	{
		id: "returns",
		title: "Returns & Exchanges",
		questions: [
			{
				question: "What is your return policy?",
				answer:
					"Return eligibility, steps, fees, and refund timing are set out in the published Returns & Refunds policy. Please check that policy before ordering.",
			},
			{
				question: "How do I initiate a return?",
				answer:
					"To start a return, contact our support team with your order number and the reason for the return. We'll provide you with return instructions and, if applicable, a return shipping label.",
			},
			{
				question: "How do exchanges work?",
				answer:
					"Exchange options depend on the current Returns & Refunds policy. Contact support with your order number before sending anything back.",
			},
			{
				question: "How long does it take to receive a refund?",
				answer:
					"The current refund timing and method are described in the Returns & Refunds policy for your order. Contact support if you need help with a refund already in progress.",
			},
		],
	},
];
