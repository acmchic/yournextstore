import { Link } from "@inertiajs/react";
import { Layers, LayoutGrid, Package, ShoppingBag, Wrench } from "lucide-react";
import AppLogo from "@/components/app-logo";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { dashboard } from "@/routes";
import type { NavItem } from "@/types";

const mainNavItems: NavItem[] = [
	{
		title: "Dashboard",
		href: dashboard(),
		icon: LayoutGrid,
	},
	{ title: "Products", href: "/products", icon: Package },
	{ title: "Catalog", href: "/catalog", icon: Layers },
	{ title: "Orders", href: "/orders", icon: ShoppingBag },
	{ title: "Carts", href: "/carts", icon: ShoppingBag },
	{ title: "Shipping & business", href: "/checkout-settings", icon: Layers },
	{ title: "Policies", href: "/legal", icon: Layers },
	{ title: "Collections", href: "/collections", icon: Layers },
	{ title: "Vận hành", href: "/operations", icon: Wrench },
];

export function AppSidebar() {
	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link href={dashboard()} prefetch>
								<AppLogo />
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<NavMain items={mainNavItems} />
			</SidebarContent>

			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
		</Sidebar>
	);
}
