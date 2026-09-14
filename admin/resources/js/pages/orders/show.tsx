import { Head, Link, useForm } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
export default function Order({ order, items, addresses, transitions, payment }: any) {
	const form = useForm({
		fulfillment_status: "",
		expected_status: order.fulfillment_status,
	});
	return (
		<>
			<Head title={order.order_number} />
			<div className="space-y-6 p-6">
				<div className="flex justify-between">
					<div>
						<h1 className="text-2xl font-semibold">{order.order_number}</h1>
						<p className="text-muted-foreground">{order.email}</p>
					</div>
					<Button variant="outline" asChild>
						<Link href="/orders">Back</Link>
					</Button>
				</div>
				<div className="grid gap-4 md:grid-cols-3">
					<div className="rounded-xl border p-4">
						<p className="text-muted-foreground text-sm">Payment</p>
						<p className="mt-2 font-medium capitalize">{order.payment_status}</p>
					</div>
					<div className="rounded-xl border p-4">
						<p className="text-muted-foreground text-sm">Fulfillment</p>
						<p className="mt-2 font-medium capitalize">{order.fulfillment_status}</p>
					</div>
					<div className="rounded-xl border p-4">
						<p className="text-muted-foreground text-sm">Total</p>
						<p className="mt-2 font-medium">
							{(order.total_minor / 100).toLocaleString(undefined, {
								style: "currency",
								currency: order.currency,
							})}
						</p>
					</div>
				</div>
				{payment && (
					<div className="space-y-2 border-y py-4 text-sm">
						<p>
							Shipping: {payment.shipping_method} · ${(order.shipping_minor / 100).toFixed(2)}
						</p>
						<p>Tax: ${(order.tax_minor / 100).toFixed(2)}</p>
						<p className="break-all">Stripe session: {payment.stripe_session_id}</p>
						<p className="break-all">Payment: {payment.payment_intent_id}</p>
					</div>
				)}
				{transitions.length > 0 && (
					<div className="flex gap-2">
						{transitions.map((status: string) => (
							<Button
								key={status}
								onClick={() => {
									form.setData("fulfillment_status", status);
									form.patch(`/orders/${order.id}`);
								}}
							>
								Mark {status}
							</Button>
						))}
					</div>
				)}
				<div className="overflow-hidden rounded-xl border">
					<table className="w-full text-sm">
						<thead className="bg-muted/50">
							<tr>
								<th className="p-3 text-left">Item</th>
								<th className="p-3">Qty</th>
								<th className="p-3 text-right">Total</th>
							</tr>
						</thead>
						<tbody>
							{items.map((i: any) => (
								<tr className="border-t" key={i.id}>
									<td className="p-3">
										{i.title}
										<div className="text-muted-foreground">
											{i.catalog_name} · {i.color_name} · {i.size_code}
										</div>
									</td>
									<td className="p-3 text-center">{i.quantity}</td>
									<td className="p-3 text-right">
										{(i.line_total_minor / 100).toFixed(2)} {order.currency}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div className="rounded-xl border p-4">
					<h2 className="font-medium">Shipping address</h2>
					{addresses
						.filter((a: any) => a.address_type === "shipping")
						.map((a: any) => (
							<address className="text-muted-foreground mt-2 text-sm not-italic" key={a.id}>
								{a.full_name}
								<br />
								{a.line1}
								<br />
								{a.city}, {a.region} {a.postal_code}
								<br />
								{a.country_code}
							</address>
						))}
				</div>
			</div>
		</>
	);
}
