from setuptools import setup

setup(
    name='IdeaGrapher',
    packages=['webviz', 'graphstore'],
    include_package_data=True,
    install_requires=[
        'flask',
        'pymongo',
    ],
)
