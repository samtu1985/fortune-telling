import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { saveVoice, getAllVoices } from "@/app/lib/tts-settings";

async function checkAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const voices = await getAllVoices();
  return Response.json({ voices });
}

export async function PUT(request: Request) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { masterKey, locale, voiceId } = (await request.json()) as {
    masterKey: string;
    locale: string;
    voiceId: string;
  };

  if (!masterKey || !locale || !voiceId) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  await saveVoice(masterKey, locale, voiceId);
  return Response.json({ success: true });
}
