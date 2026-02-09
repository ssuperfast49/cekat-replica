async function g(n,a){try{const{data:t,error:e}=await n.from("threads").select(`
        id,
        channel_id,
        channels!inner(
          id,
          super_agent_id,
          ai_profile_id,
          ai_profiles!inner(
            id,
            message_limit
          )
        )
      `).eq("id",a).maybeSingle();if(e)throw new Error(`Failed to fetch thread data: ${e.message}`);if(!t)return{currentCount:0,limit:1e3,isExceeded:!1,superAgentId:null};const r=t.channels,s=r==null?void 0:r.ai_profiles,i=(s==null?void 0:s.message_limit)||1e3,d=(r==null?void 0:r.super_agent_id)||null,{count:u,error:o}=await n.from("messages").select("*",{count:"exact",head:!0}).eq("thread_id",a).eq("role","assistant");if(o)throw new Error(`Failed to count AI messages: ${o.message}`);const c=u||0,l=c>=i;return{currentCount:c,limit:i,isExceeded:l,superAgentId:d}}catch(t){return console.error("Error checking AI message limit:",t),{currentCount:0,limit:1e3,isExceeded:!1,superAgentId:null}}}async function m(n,a,t){try{const{data:{user:e}}=await n.auth.getUser(),r=e==null?void 0:e.id,{error:s}=await n.from("threads").update({assignee_user_id:t,assigned_by_user_id:r||null,assigned_at:new Date().toISOString(),ai_access_enabled:!1}).eq("id",a);if(s)throw new Error(`Failed to assign thread: ${s.message}`);return{success:!0}}catch(e){return console.error("Error auto-assigning to super agent:",e),{success:!1,error:e instanceof Error?e.message:"Unknown error"}}}export{m as autoAssignToSuperAgent,g as checkAIMessageLimit};
