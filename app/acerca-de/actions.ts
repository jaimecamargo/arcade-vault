"use server";

import { resend } from "@/lib/resend";

type ContactPayload = {
  name: string;
  email: string;
  message: string;
};

type ContactResult = { ok: true } | { ok: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendContactMessage(
  data: ContactPayload
): Promise<ContactResult> {
  const { name, email, message } = data;

  if (!name.trim() || !email.trim() || !message.trim()) {
    return { ok: false, error: "Todos los campos son obligatorios." };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: "El correo ingresado no es válido." };
  }

  try {
    const { error } = await resend.emails.send({
      from: "Arcade Vault <onboarding@resend.dev>",
      to: "jaime.camargo@gmail.com",
      replyTo: email,
      subject: `Nuevo mensaje de contacto de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." };
  }
}
