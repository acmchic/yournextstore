import { Head, Link } from "@inertiajs/react";

type Cart = { id: number; status: string; updated_at: string };
type Item = {
	cart_id: number;
	title: string;
	catalog: string;
	color: string;
	size: string;
	quantity: number;
	price_minor: number;
};
type Attempt = {
	cart_id: number;
	status: string;
	stripe_session_id: string | null;
};
export default function Carts({
	carts,
	items,
	attempts,
}: {
	carts: {
		data: Cart[];
		prev_page_url: string | null;
		next_page_url: string | null;
	};
	items: Item[];
	attempts: Attempt[];
}) {
	return (
		<div className="space-y-6 p-6">
			<Head title="Carts" />
			<h1 className="text-2xl font-semibold">Carts</h1>
			<p className="text-muted-foreground">
				Guest carts and checkout activity. Customer details appear on orders after verified payment.
			</p>
			{carts.data.map((cart) => (
				<section key={cart.id} className="space-y-3 rounded-lg border p-5">
					<h2 className="font-medium">
						Cart #{cart.id} · {cart.status}
					</h2>
					<p className="text-muted-foreground text-xs">Updated {cart.updated_at}</p>
					{items
						.filter((item) => item.cart_id === cart.id)
						.map((item, index) => (
							<p key={`${cart.id}-${index}`} className="text-sm">
								{item.quantity} × {item.title} — {item.catalog} / {item.color} / {item.size} · $
								{((item.price_minor * item.quantity) / 100).toFixed(2)}
							</p>
						))}
					{attempts
						.filter((attempt) => attempt.cart_id === cart.id)
						.map((attempt, index) => (
							<p key={`${cart.id}-attempt-${index}`} className="text-muted-foreground text-xs break-all">
								Checkout: {attempt.status} {attempt.stripe_session_id}
							</p>
						))}
				</section>
			))}
			<nav className="flex gap-5" aria-label="Pagination">
				{carts.prev_page_url && <Link href={carts.prev_page_url}>Previous</Link>}
				{carts.next_page_url && <Link href={carts.next_page_url}>Next</Link>}
			</nav>
		</div>
	);
}
