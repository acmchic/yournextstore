import { Head, Link, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

type Rates = {
    standard_first_minor: number;
    standard_additional_minor: number;
    express_first_minor: number;
    express_additional_minor: number;
    pdp_assurance_enabled: boolean;
    processing_min_business_days: number | null;
    processing_max_business_days: number | null;
    standard_transit_min_business_days: number | null;
    standard_transit_max_business_days: number | null;
    express_transit_min_business_days: number | null;
    express_transit_max_business_days: number | null;
};
const labels: Record<string, string> = {
    business_name: 'Business / legal name',
    business_address: 'Business address',
    support_email: 'Support email',
    about_story: 'About TeeBravo',
    restrictions: 'US destinations and delivery restrictions',
    returns_eligibility:
        'Return eligibility: defective items, change of mind, incorrect size',
    returns_window: 'Return request window',
    returns_method: 'Return instructions and address',
    returns_fees: 'Return shipping and other fees',
    refund_timing: 'Refund processing and timing',
};
const rateFields = [
    ['standard_first_minor', 'Standard shipping, first item'],
    ['standard_additional_minor', 'Standard shipping, each additional item'],
    ['express_first_minor', 'Express shipping, first item'],
    ['express_additional_minor', 'Express shipping, each additional item'],
] as const;
const deliveryFields = [
    ['processing_min_business_days', 'Processing minimum'],
    ['processing_max_business_days', 'Processing maximum'],
    ['standard_transit_min_business_days', 'Standard transit minimum'],
    ['standard_transit_max_business_days', 'Standard transit maximum'],
    ['express_transit_min_business_days', 'Express transit minimum'],
    ['express_transit_max_business_days', 'Express transit maximum'],
] as const;
export default function CheckoutSettings({
    settings,
    details,
    fields,
}: {
    settings: Rates;
    details: Record<string, string>;
    fields: string[];
}) {
    const form = useForm({
        standard_first_minor: settings.standard_first_minor,
        standard_additional_minor: settings.standard_additional_minor,
        express_first_minor: settings.express_first_minor,
        express_additional_minor: settings.express_additional_minor,
        pdp_assurance_enabled: Boolean(settings.pdp_assurance_enabled),
        processing_min_business_days: settings.processing_min_business_days,
        processing_max_business_days: settings.processing_max_business_days,
        standard_transit_min_business_days:
            settings.standard_transit_min_business_days,
        standard_transit_max_business_days:
            settings.standard_transit_max_business_days,
        express_transit_min_business_days:
            settings.express_transit_min_business_days,
        express_transit_max_business_days:
            settings.express_transit_max_business_days,
        details: Object.fromEntries(
            fields.map((key) => [key, details[key] || '']),
        ),
    });
    return (
        <div className="space-y-6 p-6">
            <Head title="Shipping & business" />
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold">
                        Shipping & business
                    </h1>
                    <p className="text-muted-foreground max-w-3xl">
                        USD shipping charges apply to total item quantity across
                        all products in an order. Policies remain drafts until
                        you complete and publish them.
                    </p>
                </header>
                <form
                    className="space-y-6"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.put('/checkout-settings');
                    }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle>Shipping rates</CardTitle>
                            <CardDescription>
                                Set the amount in USD cents for the first item
                                and each additional item in an order.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid gap-5 sm:grid-cols-2">
                                {rateFields.map(([key, label]) => (
                                    <div key={key} className="grid gap-2">
                                        <Label htmlFor={key}>
                                            {label} (USD cents)
                                        </Label>
                                        <Input
                                            id={key}
                                            type="number"
                                            min="0"
                                            max="100000"
                                            step="1"
                                            required
                                            value={form.data[key]}
                                            onChange={(event) =>
                                                form.setData(
                                                    key,
                                                    Number(event.target.value),
                                                )
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="bg-muted/50 text-muted-foreground rounded-md p-3 text-sm">
                                500 cents = $5.00. First item + additional item
                                price × (quantity − 1). Existing checkout
                                sessions and paid orders retain their quoted
                                rates.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Delivery information</CardTitle>
                            <CardDescription>
                                Keep these ranges aligned with the published
                                shipping policy.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="flex items-start gap-3 rounded-lg border p-4">
                                <Checkbox
                                    id="pdp-assurance-enabled"
                                    checked={form.data.pdp_assurance_enabled}
                                    onCheckedChange={(checked) =>
                                        form.setData(
                                            'pdp_assurance_enabled',
                                            checked === true,
                                        )
                                    }
                                />
                                <div className="grid gap-1">
                                    <Label
                                        htmlFor="pdp-assurance-enabled"
                                        className="cursor-pointer"
                                    >
                                        Show delivery and purchase information
                                        on product pages
                                    </Label>
                                    <p className="text-muted-foreground text-sm">
                                        Dates are calculated in US business
                                        days. Leave this off until all ranges
                                        match the published shipping policy.
                                    </p>
                                </div>
                            </div>
                            <div className="grid gap-5 sm:grid-cols-2">
                                {deliveryFields.map(([key, label]) => (
                                    <div key={key} className="grid gap-2">
                                        <Label htmlFor={key}>
                                            {label} (business days)
                                        </Label>
                                        <Input
                                            id={key}
                                            type="number"
                                            min="0"
                                            max="60"
                                            step="1"
                                            value={form.data[key] ?? ''}
                                            onChange={(event) =>
                                                form.setData(
                                                    key,
                                                    event.target.value === ''
                                                        ? null
                                                        : Number(
                                                              event.target
                                                                  .value,
                                                          ),
                                                )
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Policy information</CardTitle>
                            <CardDescription>
                                These values populate the storefront policy
                                pages and their dynamic placeholders.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {fields.map((key) => (
                                <div key={key} className="grid gap-2">
                                    <Label htmlFor={`details-${key}`}>
                                        {labels[key] || key}
                                    </Label>
                                    <Textarea
                                        id={`details-${key}`}
                                        className="min-h-28"
                                        maxLength={5000}
                                        value={form.data.details[key]}
                                        onChange={(event) =>
                                            form.setData('details', {
                                                ...form.data.details,
                                                [key]: event.target.value,
                                            })
                                        }
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        Dynamic field: {`{{${key}}}`}
                                    </p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {Object.entries(form.errors).map(([key, error]) => (
                        <p
                            key={key}
                            role="alert"
                            className="bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
                        >
                            {error}
                        </p>
                    ))}
                    <div className="flex flex-wrap items-center gap-3">
                        <Button disabled={form.processing}>
                            {form.processing && <Spinner />}
                            Save settings
                        </Button>
                        <Button variant="link" asChild className="px-0">
                            <Link href="/legal">Review policy drafts</Link>
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
