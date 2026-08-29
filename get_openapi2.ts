import 'dotenv/config';
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co/rest/v1/?apikey=" + process.env.SUPABASE_SERVICE_ROLE_KEY;
fetch(url)
  .then(res => res.json())
  .then(data => {
     if (data && data.definitions) {
       console.log(Object.keys(data.definitions).filter(k => !k.endsWith('_response') && !k.endsWith('_request')));
     } else {
       console.log("No definitions found", data);
     }
  })
  .catch(console.error);
