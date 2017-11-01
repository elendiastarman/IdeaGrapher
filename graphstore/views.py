from django.shortcuts import render


# Create your views here.
def home_view(request, **kwargs):
    context = {}

    print("user:", request.user)

    return render(request, 'graphstore/home.html', context)
