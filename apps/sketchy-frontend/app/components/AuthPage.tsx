"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { BACKEND_URL } from "../config";
import { setToken } from "../lib/auth";

export function AuthPage({ isSignin }: { isSignin: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isSignin ? "/signin" : "/signup";
      const payload = isSignin
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };

      const res = await axios.post(`${BACKEND_URL}${endpoint}`, payload);

      if (!isSignin) {
        // After signup, log the user in
        const signinRes = await axios.post(`${BACKEND_URL}/signin`, {
          email: form.email,
          password: form.password,
        });
        setToken(signinRes.data.token);
      } else {
        setToken(res.data.token);
      }

      router.push("/");
    } catch (err: any) {
      setError(err?.response?.data?.msg ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-screen flex justify-center items-center p-4">
      <form
        onSubmit={onSubmit}
        className="bg-neutral-600 p-4 rounded-xl flex flex-col gap-3"
      >
        <input
          type="email"
          placeholder="email"
          value={form.email}
          onChange={onChange("email")}
          required
        />
        {!isSignin && (
          <input
            type="text"
            placeholder="name"
            value={form.name}
            onChange={onChange("name")}
            required
          />
        )}
        <input
          type="password"
          placeholder="password"
          value={form.password}
          onChange={onChange("password")}
          minLength={8}
          required
        />
        {error && <span className="text-red-300 text-sm">{error}</span>}
        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : isSignin ? "Sign in" : "Sign up"}
        </button>
      </form>
    </div>
  );
}