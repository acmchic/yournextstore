import { Head, Link } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function Orders({ orders, filters }: any) {
	return (
		<>
			<Head title="Orders" />
			<div className="space-y-6 p-6">
				<div>
					<h1 className="text-2xl font-semibold">Orders</h1>
					<p className="text-muted-foreground">Review payment and fulfillment status.</p>
				</div>
				<form className="flex gap-2">
					<Input name="q" defaultValue={filters.q} placeholder="Order number or email" />
					<select
						name="status"
						defaultValue={filters.status}
						className="rounded-md border bg-background px-3"
					>
						<option value="">All fulfillment</option>
						<option value="pending">Pending</option>
						<option value="processing">Processing</option>
						<option value="shipped">Shipped</option>
						<option value="delivered">Delivered</option>
					</select>
					<Button variant="outline">Filter</Button>
				</form>
				<div className="overflow-hidden rounded-xl border">
					<table className="w-full text-sm">
						<thead className="bg-muted/50">
							<tr>
								<th className="p-3 text-left">Order</th>
								<th className="p-3 text-left">Customer</th>
								<th className="p-3 text-left">Payment</th>
								<th className="p-3 text-left">Fulfillment</th>
								<th className="p-3 text-left">Total</th>
							</tr>
						</thead>
						<tbody>
							{orders.data.map((o: any) => (
								<tr className="border-t" key={o.id}>
									<td className="p-3">
										<Link className="font-medium hover:underline" href={`/orders/${o.id}`}>
											{o.order_number}
										</Link>
										<div className="text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
									</td>
									<td className="p-3">{o.email}</td>
									<td className="p-3 capitalize">{o.payment_status}</td>
									<td className="p-3 capitalize">{o.fulfillment_status}</td>
									<td className="p-3">
										{(o.total_minor / 100).toLocaleString(undefined, {
											style: "currency",
											currency: o.currency,
										})}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
