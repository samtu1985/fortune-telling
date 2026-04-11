import PurchaseHistory from "@/app/components/account/PurchaseHistory";

export default function AccountPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-serif text-3xl text-gold mb-8">我的帳戶</h1>
      <PurchaseHistory />
    </div>
  );
}
