import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const s = await searchParams;
  return <LoginForm initialError={s.error} />;
}
