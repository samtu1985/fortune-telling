import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { getTTSSettingsForAdmin, saveTTSSettings, getAllVoices } from "@/app/lib/tts-settings";

async function checkAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const settings = await getTTSSettingsForAdmin();
  const voices = await getAllVoices();

  return Response.json({ settings, voices });
}

export async function PUT(request: Request) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    apiKey?: string;
    modelId: string;
    stability: number;
    similarityBoost: number;
    style: number;
    speed: number;
  };

  await saveTTSSettings(body);
  return Response.json({ success: true });
}
