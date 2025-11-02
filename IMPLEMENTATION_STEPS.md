# Brandible Hub Enhancement - Implementation Steps

## Overview
This document outlines the step-by-step implementation of the Client Portal & Admin Portal enhancements including personalization, feedback, resources, and progress tracking.

---

## Phase 1: Database Schema Setup (Supabase)

### Step 1.1: Create Migration Files

1. **`supabase/add_progress_percent_to_projects.sql`**
   - Add `progress_percent INT DEFAULT 0` column to `projects` table

2. **`supabase/add_project_comments_table.sql`**
   - Create `project_comments` table with:
     - `id` (uuid, primary key)
     - `project_id` (uuid, references projects)
     - `author_role` (text: 'client' or 'admin')
     - `message` (text)
     - `created_at` (timestamptz)
     - RLS policies for client SELECT/INSERT on own comments

3. **`supabase/add_feedback_table.sql`**
   - Create `feedback` table with:
     - `id` (uuid, primary key)
     - `user_id` (uuid, references users/clients)
     - `project_id` (uuid, references projects)
     - `rating` (int, 1-5)
     - `comment` (text)
     - `created_at` (timestamptz)
     - Unique constraint: one feedback per project per user

4. **`supabase/add_resources_table.sql`**
   - Create `resources` table with:
     - `id` (uuid, primary key)
     - `title` (text)
     - `description` (text)
     - `file_url` (text)
     - `category` (text: 'Guides', 'Templates', 'Tutorials')
     - `visible_to` (text: 'client', 'internal', default 'client')
     - `created_at` (timestamptz)

5. **`supabase/add_client_profiles_table.sql`**
   - Create `client_profiles` table with:
     - `user_id` (uuid, primary key, references users/clients)
     - `completion_percentage` (int, 0-100)
     - `missing_items` (jsonb)
     - `updated_at` (timestamptz)

### Step 1.2: Run Migrations
- Execute each SQL file in Supabase SQL Editor
- Verify tables created in Table Editor
- Test RLS policies

---

## Phase 2: Netlify Functions (Backend API)

### Step 2.1: Create CRUD Functions

1. **`netlify/functions/get-project-comments.js`**
   - Fetch comments for a project_id
   - Filter by user_id if client role

2. **`netlify/functions/create-project-comment.js`**
   - Insert new comment
   - Auto-set author_role from JWT
   - Return created comment

3. **`netlify/functions/delete-project-comment.js`**
   - Delete comment (admin or author only)

4. **`netlify/functions/get-feedback.js`**
   - Get feedback for project (client) or all feedback (admin)
   - Calculate average rating

5. **`netlify/functions/create-feedback.js`**
   - Insert feedback (one per project per user)
   - Validate rating (1-5)
   - Return created feedback

6. **`netlify/functions/get-resources.js`**
   - Fetch resources filtered by `visible_to`
   - Client: only 'client' resources
   - Admin: all resources

7. **`netlify/functions/create-resource.js`**
   - Admin-only function
   - Upload file to Supabase Storage `resources_files` bucket
   - Insert resource record

8. **`netlify/functions/update-resource.js`**
   - Admin-only function
   - Update title, description, category, visible_to

9. **`netlify/functions/delete-resource.js`**
   - Admin-only function
   - Delete file from Storage
   - Delete resource record

10. **`netlify/functions/get-client-profile.js`**
    - Get completion percentage and missing items
    - Calculate from client data if not exists

11. **`netlify/functions/update-client-profile.js`**
    - Update completion_percentage
    - Update missing_items JSONB

12. **`netlify/functions/update-project-progress.js`**
    - Update `progress_percent` in projects table
    - Admin-only

---

## Phase 3: Client Portal Enhancements

### Step 3.1: Update `portal.html`

1. **Welcome Header**
   - Add `<div id="welcomeHeader">` at top of dashboard
   - Display "Welcome back, [first_name] 👋"

2. **Profile Completion**
   - Add progress bar section above projects
   - `<div id="profileCompletionBar">`

3. **Project Cards**
   - Add milestone progress bar to each project card
   - Add comments section below project description
   - Add expandable "View Comments" button

4. **Feedback Tab**
   - Add new sidebar link: `<a href="#feedback" class="sidebar-link">`
   - Create feedback section with:
     - Rating stars (1-5)
     - Comment textarea
     - Project selector
     - Submit button

5. **Resources Tab**
   - Add new sidebar link: `<a href="#resources" class="sidebar-link">`
   - Create resources section with:
     - Category filters (Guides, Templates, Tutorials)
     - Card grid layout
     - Download/View buttons

### Step 3.2: Update `assets/js/portal.js`

1. **Welcome Header**
   - `renderWelcomeHeader(clientData)`
   - Extract first name from client name

2. **Profile Completion**
   - `calculateProfileCompletion(clientData)`
   - Check: logo, questionnaire, files, contact info
   - `renderProfileCompletion(percentage, missingItems)`
   - `updateProfileCompletion()` - sync with Supabase

3. **Project Progress Bars**
   - `renderProjectProgress(project)` - linear progress bar
   - Fetch `progress_percent` from projects table or default 0

4. **Comments Section**
   - `fetchProjectComments(projectId)`
   - `renderProjectComments(projectId, comments)`
   - `submitProjectComment(projectId, message)`
   - Chat bubble UI with alternating colors
   - Auto-scroll to bottom

5. **Feedback Tab**
   - `renderFeedbackSection()`
   - `submitFeedback(projectId, rating, comment)`
   - Prevent duplicate submissions (check existing)

6. **Resources Tab**
   - `fetchResources(category)`
   - `renderResources(resources)`
   - `downloadResource(resourceId, fileUrl)`

---

## Phase 4: Admin Portal Enhancements

### Step 4.1: Update `admin.html`

1. **Project Modal**
   - Add progress slider: `<input type="range" id="projectProgressSlider" min="0" max="100">`
   - Display percentage: `<span id="projectProgressPercent">0%</span>`

2. **Project Feedback Tab**
   - Add new tab in admin dashboard: `<section id="projectFeedbackSection">`
   - Table with:
     - Project name
     - Average rating
     - Number of comments
     - View/Moderate button

3. **Resources Management Panel**
   - Add new section: `<section id="resourcesManagementSection">`
   - Upload form:
     - Title, Description, Category dropdown
     - File upload input
     - Visibility toggle
   - Resources list table with edit/delete actions

### Step 4.2: Update `assets/js/admin.js`

1. **Profile Completion Editor**
   - Add editor in client modal for completion percentage
   - `updateClientProfileCompletion(clientId, percentage, missingItems)`

2. **Project Progress Slider**
   - `updateProjectProgress(projectId, percent)`
   - Sync with projects table
   - Auto-update client portal progress bar

3. **Project Feedback Tab**
   - `renderProjectFeedbackTable()`
   - `fetchAllProjectFeedback()`
   - `moderateComment(commentId, action)`
   - `deleteComment(commentId)`

4. **Resources Management**
   - `renderResourcesManagement()`
   - `uploadResource(formData)`
   - `editResource(resourceId, updates)`
   - `deleteResource(resourceId)`
   - `toggleResourceVisibility(resourceId, visibleTo)`

---

## Phase 5: Styling & UX

### Step 5.1: Update `assets/css/styles.css`

1. **Progress Bars**
   - `.progress-bar` - linear gradient (Brandible blue/yellow)
   - `.progress-bar-fill` - animated fill

2. **Comments UI**
   - `.comment-bubble` - chat bubble styling
   - `.comment-client` - client messages (left, light blue)
   - `.comment-admin` - admin messages (right, dark blue)
   - `.comment-thread` - scrollable container

3. **Feedback Form**
   - `.rating-stars` - interactive star rating
   - `.star-filled` - filled star styling

4. **Resources Cards**
   - `.resource-card` - card grid layout
   - Category badges

5. **Animations**
   - `.fade-in` - smooth fade-in for new sections
   - `.skeleton` - loading placeholders

---

## Phase 6: Testing & Verification

### Step 6.1: Client Portal Tests
- [ ] Welcome header displays first name
- [ ] Profile completion calculates correctly
- [ ] Project progress bars show accurate percentages
- [ ] Comments can be submitted and displayed
- [ ] Feedback can be submitted once per project
- [ ] Resources can be filtered and downloaded

### Step 6.2: Admin Portal Tests
- [ ] Progress slider updates project progress
- [ ] Profile completion can be edited
- [ ] Feedback table shows all project feedback
- [ ] Comments can be moderated/deleted
- [ ] Resources can be uploaded/edited/deleted
- [ ] Visibility toggles work correctly

### Step 6.3: Data Sync Tests
- [ ] All new data persists in Supabase
- [ ] RLS policies prevent unauthorized access
- [ ] Real-time updates sync between admin/client views

---

## Phase 7: Deployment Checklist

- [ ] All migration files executed in Supabase
- [ ] All Netlify functions deployed
- [ ] Environment variables set (if needed)
- [ ] Storage buckets created (`resources_files`)
- [ ] RLS policies verified
- [ ] Mobile responsiveness tested
- [ ] Dark mode tested
- [ ] Error handling verified

---

## Notes

- **Authentication**: All functions must verify Netlify Identity JWT
- **Authorization**: Clients can only access their own data
- **RLS**: Row Level Security should be enabled on all new tables
- **Error Handling**: Graceful fallbacks for missing data
- **Performance**: Lazy load comments and resources
- **Mobile**: Ensure all new sections are responsive

---

## File Checklist

### New Files to Create:
- `supabase/add_progress_percent_to_projects.sql`
- `supabase/add_project_comments_table.sql`
- `supabase/add_feedback_table.sql`
- `supabase/add_resources_table.sql`
- `supabase/add_client_profiles_table.sql`
- `netlify/functions/get-project-comments.js`
- `netlify/functions/create-project-comment.js`
- `netlify/functions/delete-project-comment.js`
- `netlify/functions/get-feedback.js`
- `netlify/functions/create-feedback.js`
- `netlify/functions/get-resources.js`
- `netlify/functions/create-resource.js`
- `netlify/functions/update-resource.js`
- `netlify/functions/delete-resource.js`
- `netlify/functions/get-client-profile.js`
- `netlify/functions/update-client-profile.js`
- `netlify/functions/update-project-progress.js`

### Files to Modify:
- `portal.html` - Add new sections
- `assets/js/portal.js` - Add new functions
- `admin.html` - Add new sections
- `assets/js/admin.js` - Add new functions
- `assets/css/styles.css` - Add new styles

