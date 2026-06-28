CREATE TABLE `loan_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`loan_id` text NOT NULL,
	`kind` text DEFAULT 'scenario' NOT NULL,
	`payment_type` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`due_date` text,
	`paid_date` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `loan_payments_loan_idx` ON `loan_payments` (`loan_id`);--> statement-breakpoint
CREATE INDEX `loan_payments_kind_idx` ON `loan_payments` (`kind`);--> statement-breakpoint
CREATE INDEX `loan_payments_due_idx` ON `loan_payments` (`due_date`);--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`lender_company_id` text,
	`borrower_company_id` text,
	`principal` real NOT NULL,
	`currency` text NOT NULL,
	`interest_rate` real,
	`interest_type` text DEFAULT 'fixed' NOT NULL,
	`compounding` text DEFAULT 'simple' NOT NULL,
	`repayment_type` text DEFAULT 'bullet' NOT NULL,
	`payment_frequency` text DEFAULT 'none' NOT NULL,
	`origination_date` text,
	`maturity_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lender_company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`borrower_company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `loans_lender_idx` ON `loans` (`lender_company_id`);--> statement-breakpoint
CREATE INDEX `loans_borrower_idx` ON `loans` (`borrower_company_id`);--> statement-breakpoint
CREATE INDEX `loans_status_idx` ON `loans` (`status`);