import { Head, Link } from "@inertiajs/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function Dashboard({ counts, recentOrders }: any) {
	return (
		<>
			<Head title="Dashboard" />
			<div className="space-y-6 p-6">
				<div>
					<h1 className="text-2xl font-semibold">Teeravo Admin</h1>
					<p className="text-muted-foreground">Store operations at a glance.</p>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					{[
						["Products", counts.products, "/products"],
						["Active", counts.activeProducts, "/products?status=active"],
						["Catalogs", counts.catalogs, "/catalog"],
						["Orders", counts.orders, "/orders"],
						["Pending", counts.pendingOrders, "/orders?status=pending"],
					].map(([label, value, href]) => (
						<Link href={href as string} key={label as string}>
							<Card className="transition hover:bg-muted/40">
								<CardHeader>
									<CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
								</CardHeader>
								<CardContent className="text-3xl font-semibold">{value}</CardContent>
							</Card>
						</Link>
					))}
				</div>
				<Card>
					<CardHeader>
						<CardTitle>Recent orders</CardTitle>
					</CardHeader>
					<CardContent>
						{recentOrders.length === 0 ? (
							<p className="text-muted-foreground">No orders yet.</p>
						) : (
							<div className="space-y-3">
								{recentOrders.map((o: any) => (
									<Link
										className="flex justify-between rounded-md p-2 hover:bg-muted"
										href={`/orders/${o.id}`}
										key={o.id}
									>
										<span>
											{o.order_number}
											<span className="ml-3 text-muted-foreground">{o.email}</span>
										</span>
										<span className="capitalize">{o.fulfillment_status}</span>
									</Link>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
