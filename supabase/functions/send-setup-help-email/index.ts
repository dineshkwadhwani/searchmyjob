import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ServiceInfo {
  key: string
  label: string
  why: string
  steps: string[]
  path: string
  linkLabel: string
}

const SERVICES: ServiceInfo[] = [
  {
    key: 'apify',
    label: 'Apify Connector',
    why: 'Apify powers our job search — it’s what lets SearchMyJob AI scan LinkedIn, Naukri, and Indeed on your behalf. Without it, we have no way to search for jobs for you.',
    steps: [
      'Create a free account at apify.com',
      'Go to Settings → Integrations → API tokens and copy your personal API token',
      'Paste it into SearchMyJob AI under Settings → Apify Connector',
    ],
    path: '/settings/apify',
    linkLabel: 'Connect Apify',
  },
  {
    key: 'groq',
    label: 'Groq Connector',
    why: 'Groq powers every AI feature in the app — match scoring against job descriptions, resume customization for a specific role, and the ATS resume rewrite. Without it, none of the AI-assisted features are available to you.',
    steps: [
      'Create a free account at console.groq.com',
      'Go to API Keys and create a new key',
      'Paste it into SearchMyJob AI under Settings → Groq Connector',
    ],
    path: '/settings/groq',
    linkLabel: 'Connect Groq',
  },
  {
    key: 'resume',
    label: 'Resume',
    why: 'Your resume is the foundation everything else is built on — we use it to calculate your match score against each job and to generate a version tailored to a specific role. Without one uploaded, matching and customization can’t run.',
    steps: [
      'Go to Settings → Resume',
      'Upload your resume as a PDF, DOCX, or TXT file',
    ],
    path: '/settings/resume',
    linkLabel: 'Upload Resume',
  },
  {
    key: 'searchConfig',
    label: 'Search Config',
    why: 'A search configuration tells us exactly what to look for on your behalf — which roles, which locations, and which skills. Without at least one saved, we don’t know what jobs to search for.',
    steps: [
      'Go to Settings → Search',
      'Add up to 3 job titles, 3 locations, and 3 supporting skills',
      'Save your search configuration',
    ],
    path: '/settings/search',
    linkLabel: 'Set Up Search',
  },
]

function buildEmailHtml(email: string, siteUrl: string, missing: ServiceInfo[]): string {
  const firstName = email.split('@')[0]

  const sections = missing.map((s, i) => `
    <tr>
      <td style="padding: 24px 0; border-top: 1px solid #e5e7eb;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align: top; width: 32px;">
              <div style="width: 24px; height: 24px; border-radius: 999px; background-color: #f59e0b; color: #ffffff; font-size: 13px; font-weight: 700; text-align: center; line-height: 24px;">${i + 1}</div>
            </td>
            <td style="vertical-align: top;">
              <p style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #0f172a;">${s.label}</p>
              <p style="margin: 0 0 12px; font-size: 14px; line-height: 22px; color: #475569;">${s.why}</p>
              <ol style="margin: 0 0 16px; padding-left: 20px; font-size: 14px; line-height: 22px; color: #334155;">
                ${s.steps.map(step => `<li style="margin-bottom: 4px;">${step}</li>`).join('')}
              </ol>
              <a href="${siteUrl}${s.path}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 8px;">${s.linkLabel} &rarr;</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 28px 32px;">
              <p style="margin: 0; font-size: 18px; font-weight: 800; color: #ffffff;">SearchMyJob AI</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">Hi ${firstName},</p>
              <p style="margin: 0 0 8px; font-size: 15px; line-height: 24px; color: #334155;">
                We noticed your SearchMyJob AI account isn't fully set up yet. A few things below still need
                your attention before we can start finding and matching jobs for you.
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 24px; color: #334155;">
                Here's exactly what's missing and how to fix it &mdash; each one takes a couple of minutes:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${sections}
              </table>
              <p style="margin: 28px 0 0; font-size: 14px; line-height: 22px; color: #64748b;">
                Once these are set up, we'll be able to search for jobs across LinkedIn, Naukri, and Indeed on
                your behalf, score how well each one matches your resume, and prepare a tailored version of
                your resume for the roles you want most.
              </p>
              <p style="margin: 24px 0 0; font-size: 15px; color: #334155;">
                We're here to help if you get stuck at any step.
              </p>
              <p style="margin: 20px 0 0; font-size: 15px; color: #0f172a;">
                Best,<br/>The SearchMyJob AI Team
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                You're receiving this because your SearchMyJob AI account setup is incomplete. This is a one-time
                courtesy notice sent by our support team.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const authHeader = req.headers.get('Authorization')!
    const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })

    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'superadmin') {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders })
    }

    const { user_id } = await req.json()
    if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400, headers: corsHeaders })

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user_id).single()
    if (!profile) return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })

    const { count: configCount } = await supabase.from('search_config').select('id', { count: 'exact', head: true }).eq('user_id', user_id)
    const { data: resume } = await supabase.from('resumes').select('id').eq('user_id', user_id).eq('is_active', true).maybeSingle()

    const status = {
      apify: !!profile.apify_key_encrypted,
      groq: !!profile.groq_key_encrypted,
      resume: !!resume,
      searchConfig: (configCount ?? 0) > 0,
    }

    const missing = SERVICES.filter(s => !status[s.key as keyof typeof status])
    if (missing.length === 0) {
      return Response.json({ error: 'This user already has all core services set up.' }, { status: 400, headers: corsHeaders })
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? ''
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')!
    const fromName = Deno.env.get('RESEND_FROM_NAME') ?? 'SearchMyJob AI'
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!

    const html = buildEmailHtml(profile.email, siteUrl, missing)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [profile.email],
        subject: 'A few quick steps to finish setting up SearchMyJob AI',
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Resend error:', data)
      return Response.json({ error: data?.message ?? 'Failed to send email' }, { status: 502, headers: corsHeaders })
    }

    return Response.json({ success: true, missing: missing.map(s => s.key) }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('send-setup-help-email error:', err)
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders })
  }
})
