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
        
        // Get profiles data  
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select(`
            user_id, 
            first_name, 
            last_name, 
            created_at, 
            updated_at, 
            address, 
            state, 
            zip, 
            phone, 
            last_active_group_id
          `)
        
        // Get admin roles data
        const { data: adminRoles, error: adminRolesError } = await supabaseAdmin
          .from('admin_roles')
          .select('user_id, role')
          .eq('role', 'system_admin')
        
        console.log('Profiles query result:', { profiles, profilesError })
        console.log('Admin roles query result:', { adminRoles, adminRolesError })
        
        // Merge auth users with profile data and admin status
        const usersWithProfiles = users.users.map(authUser => {
          const profile = profiles?.find(p => p.user_id === authUser.id) || null
          // Check if user has system_admin role
          const isAdmin = adminRoles?.some((role: any) => role.user_id === authUser.id) || false
          
          return {
            id: authUser.id,
            email: authUser.email, // Always from auth.users
            created_at: authUser.created_at,
            last_sign_in_at: authUser.last_sign_in_at,
            email_confirmed_at: authUser.email_confirmed_at,
            is_platform_admin: isAdmin,
            profile: profile ? {
              first_name: profile.first_name,
              last_name: profile.last_name,
              address: profile.address,
              state: profile.state,
              zip: profile.zip,
              phone: profile.phone,
              last_active_group_id: profile.last_active_group_id
            } : null
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