from django import forms


class RegisterForm(forms.Form):
  username = forms.CharField(label='Username', max_length=50)
  password = forms.CharField(label='Password', min_length=8)
  email = forms.CharField(label='Email')


class LoginForm(forms.Form):
  username = forms.CharField(label='Username', max_length=50)
  password = forms.CharField(label='Password', min_length=8)
