import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-customer-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './customer-layout.component.html'
})
export class CustomerLayoutComponent {
  cartItemCount = 2; // Mock count
}
