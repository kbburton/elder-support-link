import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Add detailed logging
function log(message: string, data?: any) {
  console.log(`[create-next-recurring-task] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log('Function invoked', { method: req.method, url: req.url });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { taskId, completedAt } = await req.json()
    log('Request body parsed', { taskId, completedAt });

    if (!taskId) {
      log('Missing taskId in request');
      return new Response(
        JSON.stringify({ error: 'taskId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the completed task and its recurrence rule
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        *,
        task_recurrence_rules(*)
      `)
      .eq('id', taskId)
      .single()

    if (taskError) {
      log('Error fetching task', taskError);
      throw taskError
    }

    if (!task.task_recurrence_rules || task.task_recurrence_rules.length === 0) {
      log('No recurrence rules found for task', { taskId });
      return new Response(
        JSON.stringify({ message: 'Task is not recurring' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rule = task.task_recurrence_rules[0]
    log('Processing recurrence rule', rule);

    // Check if we should create more occurrences
    if (rule.end_type === 'after_occurrences' && rule.created_occurrences >= rule.end_after_occurrences) {
      log('Maximum occurrences reached', { created: rule.created_occurrences, max: rule.end_after_occurrences });
      return new Response(
        JSON.stringify({ message: 'Maximum occurrences reached' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate next due date
    const baseDate = new Date()
    const originalDueDate = task.due_date ? new Date(task.due_date) : null
    let nextDueDate: Date | null = null

    if (originalDueDate) {
      // For overdue tasks, base calculation from today instead of original due date
      const isOverdue = originalDueDate < baseDate
      const calculationBase = isOverdue ? baseDate : originalDueDate

      switch (rule.pattern_type) {
        case 'daily':
          nextDueDate = new Date(calculationBase)
          nextDueDate.setDate(nextDueDate.getDate() + rule.interval_value)
          break

        case 'weekly':
          if (rule.weekly_days && rule.weekly_days.length > 0) {
            // Find next occurrence for weekly pattern with specific days
            nextDueDate = new Date(calculationBase)
            nextDueDate.setDate(nextDueDate.getDate() + 1) // Start from next day
            
            // Find the next day that matches the weekly pattern
            let found = false
            for (let i = 0; i < 14; i++) { // Check up to 2 weeks ahead
              const dayOfWeek = nextDueDate.getDay()
              if (rule.weekly_days.includes(dayOfWeek)) {
                found = true
                break
              }
              nextDueDate.setDate(nextDueDate.getDate() + 1)
            }
            
            if (!found) {
              // Fallback to simple weekly increment
              nextDueDate = new Date(calculationBase)
              nextDueDate.setDate(nextDueDate.getDate() + (7 * rule.interval_value))
            }
          } else {
            // Simple weekly increment
            nextDueDate = new Date(calculationBase)
            nextDueDate.setDate(nextDueDate.getDate() + (7 * rule.interval_value))
          }
          break

        case 'monthly':
          nextDueDate = new Date(calculationBase)
          if (rule.monthly_day_of_month) {
            // Specific day of month
            nextDueDate.setMonth(nextDueDate.getMonth() + rule.interval_value)
            nextDueDate.setDate(rule.monthly_day_of_month)
          } else if (rule.monthly_nth_weekday && rule.monthly_weekday !== null) {
            // Nth weekday of month (e.g., 2nd Tuesday)
            nextDueDate.setMonth(nextDueDate.getMonth() + rule.interval_value)
            nextDueDate.setDate(1) // Start of month
            
            // Find the nth occurrence of the specified weekday
            let count = 0
            for (let day = 1; day <= 31; day++) {
              nextDueDate.setDate(day)
              if (nextDueDate.getMonth() !== (calculationBase.getMonth() + rule.interval_value) % 12) break
              if (nextDueDate.getDay() === rule.monthly_weekday) {
                count++
                if (count === rule.monthly_nth_weekday) break
              }
            }
          }
          break

        case 'yearly':
          if (rule.yearly_month && rule.yearly_day) {
            nextDueDate = new Date(calculationBase)
            nextDueDate.setFullYear(nextDueDate.getFullYear() + rule.interval_value)
            nextDueDate.setMonth(rule.yearly_month - 1) // Month is 0-indexed
            nextDueDate.setDate(rule.yearly_day)
          }
          break
      }
    }

    log('Calculated next due date', { nextDueDate: nextDueDate?.toISOString() });

    // Check end date condition
    if (rule.end_type === 'until_date' && rule.end_until_date) {
      const endDate = new Date(rule.end_until_date)
      if (nextDueDate && nextDueDate > endDate) {
        log('Next due date exceeds end date', { nextDueDate: nextDueDate.toISOString(), endDate: endDate.toISOString() });
        return new Response(
          JSON.stringify({ message: 'End date reached' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create next task instance
    const nextTaskData = {
      title: task.title,
      description: task.description,
      status: 'Open' as const,
      priority: task.priority,
      category: task.category,
      due_date: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
      primary_owner_id: task.primary_owner_id,
      secondary_owner_id: task.secondary_owner_id,
      created_by_user_id: task.created_by_user_id,
      group_id: task.group_id,
    }

    log('Creating next task instance', nextTaskData);

    const { data: newTask, error: createError } = await supabase
      .from('tasks')
      .insert(nextTaskData)
      .select()
      .single()

    if (createError) {
      log('Error creating next task', createError);
      throw createError
    }

    log('Next task created successfully', { newTaskId: newTask.id });

    // Copy linked contacts from the original task
    const { data: linkedContacts, error: contactError } = await supabase
      .from('contact_tasks')
      .select('contact_id')
      .eq('task_id', taskId)

    if (contactError) {
      log('Error fetching linked contacts', contactError);
    } else if (linkedContacts && linkedContacts.length > 0) {
      log('Copying linked contacts', { count: linkedContacts.length });
      
      const contactLinks = linkedContacts.map(link => ({
        task_id: newTask.id,
        contact_id: link.contact_id
      }))

      const { error: linkError } = await supabase
        .from('contact_tasks')
        .insert(contactLinks)

      if (linkError) {
        log('Error copying contact links', linkError);
      } else {
        log('Contact links copied successfully');
      }
    }

    // Copy linked documents from the original task
    const { data: linkedDocuments, error: docError } = await supabase
      .from('task_documents')
      .select('document_id, created_by_user_id')
      .eq('task_id', taskId)

    if (docError) {
      log('Error fetching linked documents', docError);
    } else if (linkedDocuments && linkedDocuments.length > 0) {
      log('Copying linked documents', { count: linkedDocuments.length });
      
      const documentLinks = linkedDocuments.map(link => ({
        task_id: newTask.id,
        document_id: link.document_id,
        created_by_user_id: link.created_by_user_id
      }))

      const { error: docLinkError } = await supabase
        .from('task_documents')
        .insert(documentLinks)

      if (docLinkError) {
        log('Error copying document links', docLinkError);
      } else {
        log('Document links copied successfully');
      }
    }

    // Update recurrence rule tracking
    const { error: updateRuleError } = await supabase
      .from('task_recurrence_rules')
      .update({
        created_occurrences: rule.created_occurrences + 1,
        last_occurrence_date: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null
      })
      .eq('id', rule.id)

    if (updateRuleError) {
      log('Error updating recurrence rule', updateRuleError);
      // Don't fail the whole operation for this
    } else {
      log('Recurrence rule updated successfully');
    }

    log('Operation completed successfully', { 
      originalTaskId: taskId, 
      newTaskId: newTask.id,
      newDueDate: nextDueDate?.toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        newTaskId: newTask.id,
        newDueDate: nextDueDate?.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    log('Function error', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})