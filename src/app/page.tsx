import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>MegaRomBuilder</h1>
      <p>The editor arrives in a later plan.</p>
      <p>
        <Link href="/play">Play the demo stage</Link>
      </p>
    </main>
  );
}
