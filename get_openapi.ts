import 'dotenv/config';
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co/rest/v1/?apikey=" + process.env.SUPABASE_ANON_KEY;
fetch(url)
  .then(res => res.json())
  .then(data => {
     if (data && data.definitions) {
       console.log(Object.keys(data.definitions));
     } else {
       console.log("No definitions found", data);
     }
  })
  .catch(console.error);
