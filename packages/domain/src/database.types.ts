
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "date_ideas": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"link": string | null,"linked_event_id": string | null,"note": string | null,"pair_id": string,"state": string,"title": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by": string,"id": string,"link"?: string | null,"linked_event_id"?: string | null,"note"?: string | null,"pair_id": string,"state"?: string,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"link"?: string | null,"linked_event_id"?: string | null,"note"?: string | null,"pair_id"?: string,"state"?: string,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "date_ideas_pair_id_created_by_fkey"
      columns: ["pair_id","created_by"]
isOneToOne: false
      referencedRelation: "pair_members"
      referencedColumns: ["pair_id","user_id"]
    },{
      foreignKeyName: "date_ideas_pair_id_fkey"
      columns: ["pair_id"]
isOneToOne: false
      referencedRelation: "pairs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "date_ideas_pair_id_linked_event_id_fkey"
      columns: ["pair_id","linked_event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["pair_id","id"]
    }
                  ]
                },"devices": {
                  Row: {
                    "expo_token": string | null,"id": string,"installation_id": string,"last_seen_at": string,"permission": string,"platform": string,"revoked_at": string | null,"session_id": string,"user_id": string,"version": number
                  }
                  Insert: {
                    "expo_token"?: string | null,"id"?: string,"installation_id": string,"last_seen_at"?: string,"permission": string,"platform": string,"revoked_at"?: string | null,"session_id": string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "expo_token"?: string | null,"id"?: string,"installation_id"?: string,"last_seen_at"?: string,"permission"?: string,"platform"?: string,"revoked_at"?: string | null,"session_id"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"event_access_revocations": {
                  Row: {
                    "event_id": string,"pair_id": string,"revoked_at": string,"user_id": string
                  }
                  Insert: {
                    "event_id": string,"pair_id": string,"revoked_at"?: string,"user_id": string
                  }
                  Update: {
                    "event_id"?: string,"pair_id"?: string,"revoked_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_access_revocations_pair_id_event_id_fkey"
      columns: ["pair_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["pair_id","id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"created_by": string,"description": string | null,"end_date_exclusive": string | null,"ends_at": string | null,"id": string,"important_date": boolean,"location": string | null,"owner": string,"pair_id": string,"repeat": string,"repeat_day": number | null,"repeat_month": number | null,"start_date": string | null,"starts_at": string | null,"timezone": string,"title": string,"updated_at": string,"version": number,"visibility": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by": string,"description"?: string | null,"end_date_exclusive"?: string | null,"ends_at"?: string | null,"id": string,"important_date"?: boolean,"location"?: string | null,"owner": string,"pair_id": string,"repeat"?: string,"repeat_day"?: number | null,"repeat_month"?: number | null,"start_date"?: string | null,"starts_at"?: string | null,"timezone": string,"title": string,"updated_at"?: string,"version"?: number,"visibility": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"description"?: string | null,"end_date_exclusive"?: string | null,"ends_at"?: string | null,"id"?: string,"important_date"?: boolean,"location"?: string | null,"owner"?: string,"pair_id"?: string,"repeat"?: string,"repeat_day"?: number | null,"repeat_month"?: number | null,"start_date"?: string | null,"starts_at"?: string | null,"timezone"?: string,"title"?: string,"updated_at"?: string,"version"?: number,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_pair_id_created_by_fkey"
      columns: ["pair_id","created_by"]
isOneToOne: false
      referencedRelation: "pair_members"
      referencedColumns: ["pair_id","user_id"]
    },{
      foreignKeyName: "events_pair_id_fkey"
      columns: ["pair_id"]
isOneToOne: false
      referencedRelation: "pairs"
      referencedColumns: ["id"]
    }
                  ]
                },"memories": {
                  Row: {
                    "caption": string,"created_at": string,"created_by": string,"id": string,"memory_date": string,"pair_id": string,"state": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "caption"?: string,"created_at"?: string,"created_by": string,"id": string,"memory_date": string,"pair_id": string,"state"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "caption"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"memory_date"?: string,"pair_id"?: string,"state"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "memories_pair_id_created_by_fkey"
      columns: ["pair_id","created_by"]
isOneToOne: false
      referencedRelation: "pair_members"
      referencedColumns: ["pair_id","user_id"]
    },{
      foreignKeyName: "memories_pair_id_fkey"
      columns: ["pair_id"]
isOneToOne: false
      referencedRelation: "pairs"
      referencedColumns: ["id"]
    }
                  ]
                },"memory_access_revocations": {
                  Row: {
                    "created_at": string,"memory_id": string,"pair_id": string
                  }
                  Insert: {
                    "created_at"?: string,"memory_id": string,"pair_id": string
                  }
                  Update: {
                    "created_at"?: string,"memory_id"?: string,"pair_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memory_access_revocations_pair_id_fkey"
      columns: ["pair_id"]
isOneToOne: false
      referencedRelation: "pairs"
      referencedColumns: ["id"]
    }
                  ]
                },"memory_photos": {
                  Row: {
                    "full_bytes": number,"full_object_id": string | null,"full_path": string,"height": number,"id": string,"memory_id": string,"pair_id": string,"photo_order": number,"thumb_bytes": number,"thumb_height": number,"thumb_object_id": string | null,"thumb_path": string,"thumb_width": number,"uploaded_by": string,"validated": boolean,"width": number
                  }
                  Insert: {
                    "full_bytes": number,"full_object_id"?: string | null,"full_path": string,"height": number,"id": string,"memory_id": string,"pair_id": string,"photo_order": number,"thumb_bytes": number,"thumb_height": number,"thumb_object_id"?: string | null,"thumb_path": string,"thumb_width": number,"uploaded_by": string,"validated"?: boolean,"width": number
                  }
                  Update: {
                    "full_bytes"?: number,"full_object_id"?: string | null,"full_path"?: string,"height"?: number,"id"?: string,"memory_id"?: string,"pair_id"?: string,"photo_order"?: number,"thumb_bytes"?: number,"thumb_height"?: number,"thumb_object_id"?: string | null,"thumb_path"?: string,"thumb_width"?: number,"uploaded_by"?: string,"validated"?: boolean,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "memory_photos_pair_id_memory_id_fkey"
      columns: ["pair_id","memory_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["pair_id","id"]
    },{
      foreignKeyName: "memory_photos_pair_id_uploaded_by_fkey"
      columns: ["pair_id","uploaded_by"]
isOneToOne: false
      referencedRelation: "pair_members"
      referencedColumns: ["pair_id","user_id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "author_id": string,"body": string | null,"client_id": string,"created_at": string,"deleted_at": string | null,"id": string,"pair_id": string,"payload_hash": string,"pinned_at": string | null,"version": number
                  }
                  Insert: {
                    "author_id": string,"body"?: string | null,"client_id": string,"created_at": string,"deleted_at"?: string | null,"id"?: string,"pair_id": string,"payload_hash": string,"pinned_at"?: string | null,"version"?: number
                  }
                  Update: {
                    "author_id"?: string,"body"?: string | null,"client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"pair_id"?: string,"payload_hash"?: string,"pinned_at"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_pair_id_author_id_fkey"
      columns: ["pair_id","author_id"]
isOneToOne: false
      referencedRelation: "pair_members"
      referencedColumns: ["pair_id","user_id"]
    },{
      foreignKeyName: "messages_pair_id_fkey"
      columns: ["pair_id"]
isOneToOne: false
      referencedRelation: "pairs"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "default_event_reminder_minutes": number | null,"message_alerts": boolean,"quiet_end": string | null,"quiet_start": string | null,"timezone": string,"user_id": string,"version": number
                  }
                  Insert: {
                    "default_event_reminder_minutes"?: number | null,"message_alerts"?: boolean,"quiet_end"?: string | null,"quiet_start"?: string | null,"timezone": string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "default_event_reminder_minutes"?: number | null,"message_alerts"?: boolean,"quiet_end"?: string | null,"quiet_start"?: string | null,"timezone"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "available_at": string,"created_at": string,"id": string,"kind": string,"occurrence": string,"pair_id": string,"read_at": string | null,"reminder_id": string | null,"source_id": string,"source_version": number,"user_id": string
                  }
                  Insert: {
                    "available_at": string,"created_at"?: string,"id"?: string,"kind": string,"occurrence": string,"pair_id": string,"read_at"?: string | null,"reminder_id"?: string | null,"source_id": string,"source_version": number,"user_id": string
                  }
                  Update: {
                    "available_at"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"occurrence"?: string,"pair_id"?: string,"read_at"?: string | null,"reminder_id"?: string | null,"source_id"?: string,"source_version"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_pair_id_fkey"
      columns: ["pair_id"]
isOneToOne: false
      referencedRelation: "pairs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_reminder_id_fkey"
      columns: ["reminder_id"]
isOneToOne: false
      referencedRelation: "reminders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"pair_members": {
                  Row: {
                    "joined_at": string,"left_at": string | null,"pair_id": string,"slot": string,"user_id": string
                  }
                  Insert: {
                    "joined_at"?: string,"left_at"?: string | null,"pair_id": string,"slot": string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"left_at"?: string | null,"pair_id"?: string,"slot"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pair_members_pair_id_fkey"
      columns: ["pair_id"]
isOneToOne: false
      referencedRelation: "pairs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pair_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"pairs": {
                  Row: {
                    "created_at": string,"ended_at": string | null,"id": string,"purge_after": string | null,"state": string,"timezone": string
                  }
                  Insert: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"purge_after"?: string | null,"state"?: string,"timezone": string
                  }
                  Update: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"purge_after"?: string | null,"state"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "account_status": string,"avatar_path": string | null,"created_at": string,"display_name": string,"locale": string,"timezone": string,"updated_at": string,"user_id": string,"version": number
                  }
                  Insert: {
                    "account_status"?: string,"avatar_path"?: string | null,"created_at"?: string,"display_name": string,"locale": string,"timezone": string,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "account_status"?: string,"avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"locale"?: string,"timezone"?: string,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"reminders": {
                  Row: {
                    "active": boolean,"created_at": string,"event_id": string | null,"id": string,"minutes_before": number | null,"pair_id": string,"remind_at": string | null,"task_id": string | null,"user_id": string,"version": number
                  }
                  Insert: {
                    "active": boolean,"created_at"?: string,"event_id"?: string | null,"id": string,"minutes_before"?: number | null,"pair_id": string,"remind_at"?: string | null,"task_id"?: string | null,"user_id": string,"version"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"event_id"?: string | null,"id"?: string,"minutes_before"?: number | null,"pair_id"?: string,"remind_at"?: string | null,"task_id"?: string | null,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_pair_id_event_id_fkey"
      columns: ["pair_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["pair_id","id"]
    },{
      foreignKeyName: "reminders_pair_id_fkey"
      columns: ["pair_id"]
isOneToOne: false
      referencedRelation: "pairs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminders_pair_id_task_id_fkey"
      columns: ["pair_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["pair_id","id"]
    },{
      foreignKeyName: "reminders_pair_id_user_id_fkey"
      columns: ["pair_id","user_id"]
isOneToOne: false
      referencedRelation: "pair_members"
      referencedColumns: ["pair_id","user_id"]
    },{
      foreignKeyName: "reminders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"task_lists": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_general": boolean,"name": string,"pair_id": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id": string,"is_general"?: boolean,"name": string,"pair_id": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_general"?: boolean,"name"?: string,"pair_id"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_lists_pair_id_created_by_fkey"
      columns: ["pair_id","created_by"]
isOneToOne: false
      referencedRelation: "pair_members"
      referencedColumns: ["pair_id","user_id"]
    },{
      foreignKeyName: "task_lists_pair_id_fkey"
      columns: ["pair_id"]
isOneToOne: false
      referencedRelation: "pairs"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_id": string | null,"completed_at": string | null,"completed_by": string | null,"created_at": string,"created_by": string,"due_date": string | null,"id": string,"list_id": string,"pair_id": string,"title": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by": string,"due_date"?: string | null,"id": string,"list_id": string,"pair_id": string,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string,"due_date"?: string | null,"id"?: string,"list_id"?: string,"pair_id"?: string,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_pair_id_assignee_id_fkey"
      columns: ["pair_id","assignee_id"]
isOneToOne: false
      referencedRelation: "pair_members"
      referencedColumns: ["pair_id","user_id"]
    },{
      foreignKeyName: "tasks_pair_id_completed_by_fkey"
      columns: ["pair_id","completed_by"]
isOneToOne: false
      referencedRelation: "pair_members"
      referencedColumns: ["pair_id","user_id"]
    },{
      foreignKeyName: "tasks_pair_id_created_by_fkey"
      columns: ["pair_id","created_by"]
isOneToOne: false
      referencedRelation: "pair_members"
      referencedColumns: ["pair_id","user_id"]
    },{
      foreignKeyName: "tasks_pair_id_fkey"
      columns: ["pair_id"]
isOneToOne: false
      referencedRelation: "pairs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_pair_id_list_id_fkey"
      columns: ["pair_id","list_id"]
isOneToOne: false
      referencedRelation: "task_lists"
      referencedColumns: ["pair_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_command_id": string,"p_token": string }; Returns: Json
                           },
"archive_date_idea":
{ Args: { "p_command_id": string,"p_expected_version": number,"p_idea_id": string }; Returns: Json
                           },
"authorize_email_change":
{ Args: { "p_proof": string }; Returns: Json
                           },
"authorize_export_part":
{ Args: { "p_job_id": string,"p_part_id": string }; Returns: Json
                           },
"cancel_pending_pair":
{ Args: { "p_command_id": string,"p_pair_id": string }; Returns: Json
                           },
"claim_avatar_cleanup":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"claim_deletion_jobs":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"claim_due_jobs":
{ Args: { "p_lease_seconds"?: number,"p_limit"?: number }; Returns: Json
                           },
"claim_export_cleanup":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"claim_export_jobs":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"claim_memory_cleanup":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"claim_push_receipts":
{ Args: { "p_lease_seconds"?: number,"p_limit"?: number }; Returns: Json
                           },
"complete_avatar_cleanup":
{ Args: { "p_error_code"?: string,"p_id": string,"p_lease_token": string }; Returns: Json
                           },
"complete_deletion_step":
{ Args: { "p_error_code"?: string,"p_job_id": string,"p_lease_token": string }; Returns: Json
                           },
"complete_export_cleanup":
{ Args: { "p_error_code"?: string,"p_lease_token": string,"p_part_id": string }; Returns: Json
                           },
"complete_export_step":
{ Args: { "p_bytes": number,"p_error_code"?: string,"p_job_id": string,"p_lease_token": string,"p_part_id": string,"p_sha256": string }; Returns: Json
                           },
"complete_job":
{ Args: { "p_id": string,"p_lease_id": string,"p_outcome": Json }; Returns: Json
                           },
"complete_memory_cleanup":
{ Args: { "p_error_code"?: string,"p_job_id": string,"p_lease_token": string }; Returns: Json
                           },
"complete_push_receipt":
{ Args: { "p_id": string,"p_lease_id": string,"p_outcome": Json }; Returns: Json
                           },
"create_date_idea":
{ Args: { "p_command_id": string,"p_input": Json }; Returns: Json
                           },
"create_event":
{ Args: { "p_command_id": string,"p_input": Json }; Returns: Json
                           },
"create_invite":
{ Args: { "p_command_id": string,"p_pair_id": string }; Returns: Json
                           },
"create_list":
{ Args: { "p_command_id": string,"p_name": string,"p_pair_id": string }; Returns: Json
                           },
"create_pair":
{ Args: { "p_command_id": string,"p_timezone": string }; Returns: Json
                           },
"create_task":
{ Args: { "p_command_id": string,"p_input": Json }; Returns: Json
                           },
"delete_empty_list":
{ Args: { "p_command_id": string,"p_list_id": string }; Returns: Json
                           },
"delete_event":
{ Args: { "p_command_id": string,"p_event_id": string,"p_expected_version": number }; Returns: Json
                           },
"delete_memory":
{ Args: { "p_command_id": string,"p_expected_version": number,"p_memory_id": string }; Returns: Json
                           },
"delete_message":
{ Args: { "p_command_id": string,"p_message_id": string }; Returns: Json
                           },
"delete_task":
{ Args: { "p_command_id": string,"p_expected_version": number,"p_task_id": string }; Returns: Json
                           },
"end_pair":
{ Args: { "p_command_id": string,"p_pair_id": string,"p_verification_proof": string }; Returns: Json
                           },
"get_account_settings":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_avatar_media":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"get_deletion_monitoring":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_deletion_status":
{ Args: { "p_receipt": string }; Returns: Json
                           },
"get_export":
{ Args: { "p_job_id": string }; Returns: Json
                           },
"get_export_pairs":
{ Args: { "p_cursor"?: string }; Returns: Json
                           },
"get_export_parts":
{ Args: { "p_cursor"?: string,"p_job_id": string }; Returns: Json
                           },
"get_exports":
{ Args: { "p_cursor"?: string }; Returns: Json
                           },
"get_memory":
{ Args: { "p_memory_id": string }; Returns: Json
                           },
"get_memory_media":
{ Args: { "p_photo_id": string,"p_variant"?: string }; Returns: Json
                           },
"get_notification_preferences":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_pair_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_reminder":
{ Args: { "p_event_id": string,"p_task_id": string }; Returns: Json
                           },
"get_session_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_today":
{ Args: { "p_date": string,"p_pair_id": string }; Returns: Json
                           },
"get_unread_count":
{ Args: { "p_pair_id": string }; Returns: Json
                           },
"issue_verification_proof":
{ Args: { "p_action": string,"p_proof_hash": string,"p_session_id": string,"p_user_id": string }; Returns: Json
                           },
"latest_memory":
{ Args: { "p_pair_id": string }; Returns: Json
                           },
"list_agenda":
{ Args: { "p_from": string,"p_pair_id": string,"p_to": string }; Returns: Json
                           },
"list_memories":
{ Args: { "p_cursor"?: Json,"p_limit"?: number,"p_pair_id": string }; Returns: Json
                           },
"list_notifications":
{ Args: { "p_cursor"?: string }; Returns: Json
                           },
"mark_notification_read":
{ Args: { "p_id": string }; Returns: Json
                           },
"move_list_tasks_to_general":
{ Args: { "p_command_id": string,"p_list_id": string }; Returns: Json
                           },
"pin_message":
{ Args: { "p_command_id": string,"p_message_id": string }; Returns: Json
                           },
"plan_date_idea":
{ Args: { "p_command_id": string,"p_event_input": Json,"p_expected_version": number,"p_idea_id": string }; Returns: Json
                           },
"prepare_export_step":
{ Args: { "p_job_id": string,"p_lease_token": string }; Returns: Json
                           },
"preview_invite":
{ Args: { "p_token": string }; Returns: Json
                           },
"process_deletion_step":
{ Args: { "p_job_id": string,"p_lease_token": string,"p_limit"?: number }; Returns: Json
                           },
"publish_memory":
{ Args: { "p_actor_id": string,"p_command_id": string,"p_memory_id": string,"p_session_id": string }; Returns: Json
                           },
"reconcile_message_sends":
{ Args: { "p_client_ids": (string)[],"p_pair_id": string }; Returns: Json
                           },
"refresh_notification_horizon":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"register_device":
{ Args: { "p_input": Json }; Returns: Json
                           },
"rename_list":
{ Args: { "p_command_id": string,"p_expected_version": number,"p_list_id": string,"p_name": string }; Returns: Json
                           },
"replay_account_deletion":
{ Args: { "p_command_id": string,"p_receipt": string,"p_verification_proof": string }; Returns: Json
                           },
"request_account_deletion":
{ Args: { "p_actor_id": string,"p_command_id": string,"p_receipt": string,"p_session_id": string,"p_verification_proof": string }; Returns: Json
                           },
"request_export":
{ Args: { "p_command_id": string,"p_pair_id": string,"p_verification_proof": string }; Returns: Json
                           },
"reserve_avatar":
{ Args: { "p_bytes": number,"p_expected_version": number,"p_height": number,"p_id": string,"p_width": number }; Returns: Json
                           },
"reserve_export_evidence":
{ Args: { "p_bytes": number,"p_job_id": string,"p_lease_token": string,"p_part_id": string,"p_sha256": string }; Returns: Json
                           },
"reserve_memory":
{ Args: { "p_command_id": string,"p_input": Json }; Returns: Json
                           },
"resolve_notification":
{ Args: { "p_id": string }; Returns: Json
                           },
"retry_export":
{ Args: { "p_job_id": string }; Returns: Json
                           },
"revalidate_notification_job":
{ Args: { "p_id": string,"p_lease_id": string }; Returns: Json
                           },
"revoke_device":
{ Args: { "p_all"?: boolean,"p_installation_id": string }; Returns: Json
                           },
"save_notification_preferences":
{ Args: { "p_expected_version": number,"p_input": Json }; Returns: Json
                           },
"save_profile":
{ Args: { "p_display_name": string,"p_expected_version"?: number,"p_locale": string,"p_timezone": string }; Returns: Json
                           },
"send_message":
{ Args: { "p_body": string,"p_client_id": string,"p_pair_id": string }; Returns: Json
                           },
"set_read_cursor":
{ Args: { "p_created_at": string,"p_message_id": string,"p_pair_id": string }; Returns: Json
                           },
"set_reminder":
{ Args: { "p_command_id": string,"p_input": Json }; Returns: Json
                           },
"set_task_completed":
{ Args: { "p_command_id": string,"p_completed": boolean,"p_expected_version": number,"p_task_id": string }; Returns: Json
                           },
"unpin_message":
{ Args: { "p_command_id": string,"p_message_id": string }; Returns: Json
                           },
"update_date_idea":
{ Args: { "p_command_id": string,"p_expected_version": number,"p_idea_id": string,"p_input": Json }; Returns: Json
                           },
"update_event":
{ Args: { "p_command_id": string,"p_event_id": string,"p_expected_version": number,"p_input": Json }; Returns: Json
                           },
"update_memory":
{ Args: { "p_command_id": string,"p_expected_version": number,"p_input": Json,"p_memory_id": string }; Returns: Json
                           },
"update_pair_timezone":
{ Args: { "p_expected_timezone": string,"p_pair_id": string,"p_timezone": string }; Returns: Json
                           },
"update_task":
{ Args: { "p_command_id": string,"p_expected_version": number,"p_input": Json,"p_task_id": string }; Returns: Json
                           },
"validate_memory_photo":
{ Args: { "p_actor_id": string,"p_evidence": Json,"p_memory_id": string,"p_photo_id": string,"p_session_id": string }; Returns: Json
                           },
"verify_avatar":
{ Args: { "p_actor": string,"p_evidence"?: Json,"p_id": string,"p_session": string }; Returns: Json
                           },
"verify_memory_reservation":
{ Args: { "p_actor_id": string,"p_memory_id": string,"p_session_id": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
