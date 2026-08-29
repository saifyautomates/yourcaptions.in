import 'dotenv/config';
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co/rest/v1/?apikey=" + process.env.SUPABASE_SERVICE_ROLE_KEY;
fetch(url)
  .then(res => res.json())
  .then(data => {
     if (data && data.definitions) {
       console.log("usage_meters:", data.definitions.usage_meters.properties);
     }
  })
  .catch(console.error);
