import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">LoanLens</h1>
      <p>Proof of understanding, alongside the signature.</p>
      <Link href="/smoke" className="rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white">
        Gnani smoke test
      </Link>
    </main>
  );
}
