import { checkoutFetch } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";
import { ConfirmationRefresh } from "./confirmation-refresh";

export const metadata = {
	title: "Order confirmation",
	robots: { index: false, follow: false },
	referrer: "no-referrer" as const,
};
export const unstable_instant = false;
export default async function SuccessPage({
	searchParams,
}: {
	searchParams: Promise<{ session_id?: string }>;
}) {
	const { session_id } = await searchParams;
	const result = session_id
		? await checkoutFetch<{
				payment_status: string;
				order_number?: string;
				total_minor?: number;
				currency?: string;
			}>(`/v1/checkout/confirmation?session_id=${encodeURIComponent(session_id)}`).catch(() => null)
		: null;
	const paid = result?.payment_status === "paid";
	return (
		<main className="mx-auto max-w-2xl px-6 py-20">
			<ConfirmationRefresh active={Boolean(session_id) && !paid} />
			<p className="text-xs uppercase tracking-widest">TeeBravo</p>
			<h1 className="mt-4 text-4xl font-semibold">
				{paid ? "Thank you for your order." : "Confirming your payment"}
			</h1>
			{paid ? (
				<p className="mt-6">
					Order {result.order_number} ·{" "}
					{formatMoney({
						amount: String(result.total_minor),
						currency: result.currency || "USD",
						locale: "en-US",
					})}
				</p>
			) : (
				<p className="mt-6" role="status" aria-live="polite">
					Your payment is still being confirmed. This page will check again automatically for 30 seconds. If
					you already paid, please avoid starting another payment.
				</p>
			)}
			<a href="/products" className="mt-8 inline-block underline">
				Continue shopping
			</a>
		</main>
	);
}
