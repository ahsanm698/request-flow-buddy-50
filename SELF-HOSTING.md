# Running this app on your own Windows Server / IIS

This is a full-stack app: a React front end **plus** a Node server that renders
pages, and a PostgreSQL database that handles logins, files and all the request
data. IIS on its own cannot run it — IIS sits in front and passes traffic to the
Node server.

---

## 1. Get the code

In Lovable, open the **GitHub** menu (top right) and either:

- **Connect to GitHub** and push the project to your own repository, then clone it, or
- **Download** the project as a ZIP.

Everything in this repository is the complete application: pages, server code,
database scripts and configuration.

## 2. Install prerequisites on the server

- **Node.js 20 or newer** — https://nodejs.org
- **PostgreSQL 15 or newer** — https://www.postgresql.org/download/windows/
- **IIS** with the **URL Rewrite** and **Application Request Routing (ARR)** modules
  (both free from Microsoft) — these let IIS forward requests to Node.

## 3. Set up the database

The app's logins, file storage and security rules are provided by **Supabase**,
which is open source and can run on your own server with Docker:

```
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
copy .env.example .env      # edit passwords and keys
docker compose up -d
```

Then load the schema and starter data (departments, request types, approval
workflows):

```
psql "postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres" -f db/full-schema.sql
```

Finally create a private storage bucket named **attachments** (10 MB limit) in
the Supabase Studio that comes with the Docker setup — request attachments are
stored there.

> If you prefer plain PostgreSQL without Supabase, the tables and workflow logic
> in `db/full-schema.sql` still apply, but you would need to replace the login
> and file-upload layer yourself.

## 4. Configure the app

Copy `.env.example` to `.env` and fill in the values from your Supabase Docker
`.env` (URL, anon/publishable key, service role key, database URL).

## 5. Build and run

```
npm install
npm run build
node .output/server/index.mjs
```

The app now listens on `http://localhost:3000`.

To keep it running as a Windows service, use **PM2** (`npm i -g pm2 pm2-windows-service`)
or **NSSM**.

## 6. Point IIS at it

1. In IIS Manager create a website bound to your host name / port 80 or 443.
2. Open **Application Request Routing Cache → Server Proxy Settings** and tick
   **Enable proxy**.
3. In the site, open **URL Rewrite → Add Rule → Reverse Proxy** and enter
   `localhost:3000`.

That produces a `web.config` like this in the site folder:

```xml
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

Browse to your IIS site — the portal loads, and the first account you register
becomes the administrator.

## 7. Day-to-day notes

- **First user is the admin.** From "Team roles" they assign Manager, HR,
  Travel Office and Admin to everyone else.
- **Approval routing** lives in the database (`approval_workflows`), so you can
  change the steps for any request type with SQL, no code change needed.
- **Notifications** currently appear inside the app. To send real emails, add an
  email provider key to `.env` and wire it into the notification step.
- **HTTPS**: bind a certificate in IIS; the Node process can stay on plain HTTP
  behind it.
