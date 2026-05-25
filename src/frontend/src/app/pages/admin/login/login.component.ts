import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  templateUrl: './login.component.html'
})
export class LoginComponent {
  constructor(private router: Router) {}

  login() {
    this.router.navigate(['/admin/orders']);
  }
}
