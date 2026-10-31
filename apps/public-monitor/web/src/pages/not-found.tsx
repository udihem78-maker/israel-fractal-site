import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-extrabold">העמוד לא נמצא</h1>
      <p className="mt-2 text-muted-foreground">ייתכן שהכתובת שגויה. אפשר לחזור לסקירה.</p>
      <Link href="/" className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground" data-testid="link-404-home">
        חזרה לסקירה
      </Link>
    </div>
  );
}
