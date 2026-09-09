# Service Flow Hub

Project Title: Enterprise Employee Service Request & Workflow Management System

Objective:
Build a secure, full-stack web application to manage internal employee requests (e.g., certificates, air tickets) with dynamic, role-based approval workflows. The system must handle automated notifications, task assignments, and request lifecycle tracking.

1. Core Data Models (Database Schema)

Define the following tables/collections in the database:

Employee: id, name, email, department_id (FK), role (e.g., 'Employee', 'Manager', 'HR', 'Admin'), password_hash.

Department: id, name (e.g., HR, Finance, Travel).

RequestType: id, name (e.g., Salary Certificate, Air Ticket), department_id (FK).

ApprovalWorkflow: id, request_type_id (FK), step_order (Integer), approver_role (e.g., 'Manager', 'HR', 'Travel_Office').

Request: id, employee_id (FK), request_type_id (FK), department_id (FK), status (Pending/In-Progress/Approved/Rejected/Closed), comments, attachments (URLs), created_at, updated_at.

RequestApproval: id, request_id (FK), approver_employee_id (FK), step_order, status (Pending/Approved/Rejected), comments, action_date.

2. Core Features & User Stories

Authentication & Roles:

Implement login/signup with email and password.

Support four roles: Employee, Manager, HR, and Travel Office (or Admin).

Role-based UI/route protection (e.g., Employees see only their requests; HR sees all HR-related requests).

Employee Flow:

As an Employee, after login, I see a dashboard with:

A "New Request" button.

A list of my past requests with status.

As an Employee, when creating a request:

I select a Department.

I select a Request Type (filtered by the selected department).

I add comments and optionally attach a file.

I submit the request.

The system automatically determines the approvers based on the ApprovalWorkflow for that Request Type and assigns the task to the first approver in the sequence.

Approver Flow (Manager/HR/Travel Office):

As an Approver, I log in and see a "Pending Approvals" list.

I can open a request, view details, add comments, attach files, and choose Approve or Reject.

If approved, the system:

Moves the request to the next step in the workflow (if any).

Assigns it to the next approver.

If rejected or the final step is approved, the system updates the overall request status to Closed or Rejected.

Notification System:

Send automated email notifications for:

New request creation (to the requester and the first approver).

Status changes (e.g., "Your request has been approved/rejected").

Task assignment (to the next approver).

3. Technical Stack & Architecture

Frontend: React with TypeScript (using shadcn/ui for components).

Backend: Node.js with Express or Supabase (PostgreSQL).

Authentication: JWT-based or Supabase Auth.

Email Service: Use a service like Resend, SendGrid, or Nodemailer.

File Uploads: Support for attachments (e.g., using Supabase Storage or AWS S3).

State Management: React Query for server-state caching and updates.

4. API Endpoints (RESTful or GraphQL)

MethodEndpointDescriptionPOST/api/auth/loginUser loginGET/api/departmentsFetch all departmentsGET/api/request-types?deptId=...Fetch request types by departmentPOST/api/requestsCreate a new requestGET/api/requests/meGet current user's requestsGET/api/requests/pendingGet requests pending for the current user's approvalPUT/api/requests/:id/approveApprove a request stepPUT/api/requests/:id/rejectReject a request stepGET/api/notificationsGet user notifications (optional)

5. UI/UX Guidelines

Dashboard: Show a summary of pending actions (e.g., "You have 3 requests pending approval").

Responsive Design: Ensure the app works on both desktop and mobile.

Feedback: Provide clear success/error toasts (e.g., "Request submitted successfully!").

Loading States: Show skeleton loaders when fetching data.

6. Sample Workflow (Air Ticket)

Employee A requests an Air Ticket.

System finds workflow: Step 1 → Manager, Step 2 → HR, Step 3 → Travel Office.

Manager approves → request moves to HR.

HR approves → request moves to Travel Office.

Travel Office approves → request status updates to Closed.

Employee A receives email: "Your Air Ticket request has been closed."

7. Non-Functional Requirements

Security: Hash passwords; validate JWT tokens; implement role-based middleware.

Scalability: Structure code to handle multiple departments/request types easily.

Logging: Log actions (e.g., who approved/rejected) for audit purposes.

8. Setup & Environment Variables

Provide a .env.example file with:

env

DATABASE_URL=...
JWT_SECRET=...
EMAIL_SERVICE_API_KEY=...
FILE_STORAGE_KEY=...

Final Instruction for lovable.dev:
"Generate the complete codebase using the above specifications. Ensure the backend logic correctly handles multi-step workflows and the UI dynamically renders forms based on the selected department and request type. Include all necessary documentation for running the application locally."

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fa2a9a68-91ac-481c-9db1-15ebfc7dd4e2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
