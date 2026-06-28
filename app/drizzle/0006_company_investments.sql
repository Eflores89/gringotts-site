CREATE TABLE `company_investments` (
	`company_id` text NOT NULL,
	`investment_id` text NOT NULL,
	PRIMARY KEY(`company_id`, `investment_id`),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`investment_id`) REFERENCES `investments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `company_inv_company_idx` ON `company_investments` (`company_id`);--> statement-breakpoint
CREATE INDEX `company_inv_investment_idx` ON `company_investments` (`investment_id`);