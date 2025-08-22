import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdminActionRequest {
  action: 'list' | 'delete' | 'verify' | 'reset_password' | 'update_metadata'
  userId?: string
  userData?: any
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is platform admin
    const { data: adminCheck, error: adminError } = await supabaseClient
      .rpc('is_platform_admin', { user_uuid: user.id })

    if (adminError || !adminCheck) {
      throw new Error('Insufficient permissions - system admin required')
    }

    const { action, userId, userData }: AdminActionRequest = await req.json()

    switch (action) {
      case 'list':
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        if (listError) throw listError
        
        // Also get profiles data using admin client
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('*')
        
        console.log('Profiles query result:', { profiles, profilesError })
        
        // Merge auth users with profile data, ensuring profile is always defined
        const usersWithProfiles = users.users.map(authUser => {
          const profile = profiles?.find(p => p.user_id === authUser.id) || null
          return {
            ...authUser,
            profile
          }
        })
        
        return new Response(JSON.stringify({ users: usersWithProfiles }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'delete':
        if (!userId) throw new Error('User ID required')
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (deleteError) throw deleteError
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'verify':
        if (!userId) throw new Error('User ID required')
        const { error: verifyError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email_confirm: true
        })
        if (verifyError) throw verifyError
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'reset_password':
        if (!userId) throw new Error('User ID required')
        const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          userId: userId
        })
        if (resetError) throw resetError
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'update_metadata':
        if (!userId || !userData) throw new Error('User ID and data required')
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, userData)
        if (updateError) throw updateError
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      default:
        throw new Error('Invalid action')
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})